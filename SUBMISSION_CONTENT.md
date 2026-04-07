# Scope Lock -- Devpost Submission

---

# DELIVERABLE 1: Devpost Project Description

---

## Inspiration

Every AI agent integration today starts with the same dark pattern: "Grant access to your Gmail, Calendar, GitHub, and Slack." The user clicks "Allow All" because there is no alternative, and the agent immediately holds the keys to their entire digital life.

We asked a simple question: **what if AI agents had to earn your trust, one permission at a time?**

The principle of least privilege is foundational to security engineering, but it has been almost entirely absent from the AI agent ecosystem. Agents request maximum permissions upfront because the tooling makes progressive authorization hard. Auth0 Token Vault changes that equation -- it gives us a credential broker that can issue scoped tokens on demand, without the agent ever touching raw OAuth secrets. Scope Lock exists to prove that progressive authorization is not just possible for AI agents, but that it produces a better user experience than the "grant everything" alternative.

## What it does

Scope Lock is a security-first AI assistant that connects to five external services -- Gmail, Google Calendar, Google Tasks, GitHub, and Slack -- while enforcing three core principles:

**1. Progressive Authorization**
The agent starts with zero permissions. When a user asks "show me my emails," the agent does not silently access Gmail. Instead, Token Vault detects that the `gmail.readonly` scope is missing, raises an interrupt, and the user sees an explicit authorization prompt explaining exactly what permission is being requested and why. Only after the user grants consent does the agent proceed. Each service, each scope, each action -- authorized individually.

**2. Scope Visualization**
The Profile page displays every connected account with full transparency: which OAuth connection is active, what scopes have been granted, when the credential was created, and when it expires. Users can inspect and revoke any connected account at any time. This is not a settings page buried three menus deep -- it is a first-class part of the experience.

**3. Step-Up Authentication for High-Risk Actions**
Read-only operations like listing emails or calendar events require standard Token Vault authorization. But when the agent attempts a write operation -- drafting an email, creating a task, or making a purchase -- the system escalates. For purchases, Scope Lock triggers CIBA (Client-Initiated Backchannel Authentication), sending a push notification to the user's device with a binding message like "Do you want to buy 2 AirPods?" The agent blocks until the user explicitly approves or denies from their phone. No silent writes. No assumed consent.

## How we built it

**Architecture:** Next.js 15 App Router with the Vercel AI SDK for streaming tool-calling, powered by OpenAI's GPT-4o-mini. The frontend is a chat interface where every tool invocation flows through Auth0's authorization layer before reaching any external API.

**Auth0 Token Vault Integration:** Each external service is wrapped with `auth0AI.withTokenVault()`, which configures the OAuth connection, required scopes, and credential lifecycle. For example, Gmail read and Gmail compose are separate Token Vault configurations with different scope requirements:

- `withGmailRead` requests `gmail.readonly`
- `withGmailWrite` requests `gmail.compose`  
- `withCalendar` requests `calendar.events`
- `withGitHubConnection` uses `credentialsContext: 'tool-call'` for per-invocation credential resolution
- `withSlack` requests `channels:read` and `groups:read`
- `withTasks` requests the Google Tasks scope

When a tool is invoked and the user lacks the required credential, Token Vault raises a `TokenVaultInterrupt`. The frontend's `useInterruptions` hook from `@auth0/ai-vercel/react` catches this interrupt and renders an authorization prompt via a popup consent flow. After the user completes the OAuth grant in the popup, the tool call automatically resumes.

**credentialsContext Tuning:** GitHub's Token Vault configuration uses `credentialsContext: 'tool-call'`, which tells Token Vault to resolve credentials at the individual tool invocation level rather than at session initialization. This is critical for connections where scopes cannot be incrementally expanded and the credential must be fresh per call.

**CIBA for Async Authorization:** The `withAsyncAuthorization` wrapper implements Client-Initiated Backchannel Authentication for the shop-online tool. When triggered, it sends a push notification through Auth0 Guardian with a human-readable binding message, then awaits user approval before proceeding. If the user denies, the `AccessDeniedInterrupt` is caught and surfaced gracefully.

**Interrupt-Driven Consent Flow:** The `withInterruptions` wrapper on the server side and `useInterruptions` hook on the client side form a bidirectional interrupt protocol. When Token Vault cannot fulfill a credential request, execution pauses, the interrupt propagates to the UI, the user completes consent, and execution resumes -- all without losing conversation state. The `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` configuration ensures the agent automatically retries the tool call after consent is granted.

**Connected Accounts API:** The Profile page uses Auth0's `/me/v1/connected-accounts/accounts` endpoint to fetch and display all linked OAuth connections, including their granted scopes, creation timestamps, and expiration dates. Users can delete any connected account, immediately revoking the agent's access to that service.

## Challenges we ran into

**Google OAuth Scope Configuration for Token Vault.** Getting Google's OAuth consent screen to work correctly with Token Vault's incremental scope requests was the most time-consuming configuration challenge. Google treats certain scope combinations as incompatible, and the consent screen behavior changes based on whether the app is in testing or production mode. We had to carefully map which scopes could be requested together and which required separate connections.

**Token Vault Interrupt Handling and Conversation State.** When a tool call triggers an interrupt, the entire streaming response must be paused, the interrupt must be serialized and sent to the client, the user must complete an OAuth flow in a popup, and then the original tool call must resume with the new credential -- all without losing the conversation context. Getting the `withInterruptions` / `useInterruptions` handshake working reliably across page refreshes and popup closures required careful state management.

**CIBA Notification Channel Setup.** CIBA requires a configured push notification channel (Auth0 Guardian) and a registered device for the user. The setup documentation for this flow is sparse, and debugging why notifications were not being delivered required tracing through the Guardian enrollment, the CIBA authorization request, and the token polling mechanism.

**Raw Email HTML Parsing.** Gmail returns email bodies as raw HTML with inline styles, base64 images, and deeply nested table layouts. The LLM cannot meaningfully process raw HTML, so we built an HTML stripping pipeline that extracts clean text while preserving semantic structure -- removing style/script tags, decoding HTML entities, and collapsing whitespace.

**Credential Lifecycle and Expiration.** Token Vault credentials have expiration times, and when a token expires mid-session, the next tool call must trigger a re-authorization flow rather than failing with an opaque 401 error. We handle this by catching `TokenVaultError` and `GaxiosError` with 401 status codes and re-raising them as Token Vault interrupts, which triggers the consent popup again.

## Accomplishments that we're proud of

**Progressive authorization that feels natural.** The interrupt-driven consent flow does not feel like a security gate -- it feels like the agent politely asking permission. Users report that it builds more trust than the traditional "grant everything" OAuth screen.

**Five real API integrations, each with proper scope isolation.** Gmail read, Gmail compose, Google Calendar, Google Tasks, GitHub (repos + events), and Slack channels -- each with its own Token Vault configuration, its own scope boundaries, and its own error handling for credential failures.

**The Connected Accounts dashboard.** Seeing exactly which scopes are granted to which service, when credentials were created, and being able to revoke any of them instantly -- this is the transparency that every AI agent should provide but almost none do.

**CIBA step-up authentication for purchases.** The flow where the agent says "I need your approval to buy this" and you get a push notification on your phone -- that is the future of agent authorization for high-stakes actions.

**Zero-credential agent architecture.** The AI agent never sees, stores, or transmits a raw OAuth token. Every credential flows through Token Vault's federated exchange. If the agent's memory is compromised, there are no secrets to leak.

## What we learned

**Token Vault is the missing piece for agent authorization.** Before Token Vault, building progressive authorization required managing OAuth state machines, token storage, refresh logic, and scope tracking manually. Token Vault abstracts all of that into a single `withTokenVault()` wrapper that handles credential acquisition, caching, refresh, and interrupt signaling.

**`credentialsContext` matters more than you expect.** The difference between resolving credentials at session level vs. tool-call level determines whether an agent can handle connections that do not support incremental scope grants (like GitHub). This is a subtle but critical configuration option.

**Progressive authorization is a UX innovation, not just a security measure.** Users who see each permission requested individually with a clear explanation feel more in control than users who see a wall of checkboxes. The "earn trust incrementally" pattern produces higher completion rates than the "grant everything upfront" pattern.

**Interrupt-driven consent is the right abstraction.** Rather than pre-checking permissions before every tool call, the interrupt model lets the agent optimistically attempt actions and gracefully handle missing credentials. This maps naturally to how humans delegate tasks: "try to do this, and ask me if you need something."

**There is no standard for agent authorization audit trails.** We built scope visualization and connected account management, but the industry lacks a standard format for logging which agent accessed which API with which scope at which time. This is a gap that needs to be filled as agents become more autonomous.

## What's next for Scope Lock

**Auth0 FGA for Document-Level Access Control.** The FGA integration is already scaffolded -- we want to extend it so that when an agent accesses a specific Google Doc or GitHub repo, fine-grained authorization checks happen at the individual resource level, not just the API level.

**MCP Server Authentication.** As Model Context Protocol becomes the standard for agent-tool communication, Scope Lock's progressive authorization pattern needs to work with MCP's authentication flow. We plan to implement a Token Vault-backed MCP auth provider.

**Per-Agent Scope Isolation for Multi-Agent Systems.** When multiple agents operate on behalf of the same user, each agent should have its own scope ceiling. Agent A might have Gmail read access while Agent B has Calendar write access -- and neither can escalate beyond its assigned boundary.

**NPM Package for Progressive Authorization.** The `withTokenVault` + interrupt + consent popup pattern is reusable. We want to extract it into a standalone package that any Vercel AI SDK project can drop in to get progressive authorization out of the box.

## Built With

auth0, nextjs, vercel-ai-sdk, typescript, openai, tailwindcss, token-vault, ciba, oauth2, react, drizzle-orm, postgres

---

# DELIVERABLE 2: Bonus Blog Post

---

## Bonus Blog Post

### The Permission Problem Nobody Talks About

I built an AI agent that can read your email, check your calendar, list your GitHub repos, browse your Slack channels, and buy things on your behalf. And the first thing I did was make sure it could do absolutely none of those things until you said so.

That sounds obvious. It is not.

The standard OAuth integration pattern for AI agents goes like this: request every scope you might need during the initial login, store the tokens, and hope the user did not read the permission list too carefully. I have built apps that work this way. Most of us have. It is the path of least resistance because managing incremental scope grants is genuinely hard -- you need to track which scopes the user has already authorized, handle the re-consent flow when you need a new one, manage token refresh for each scope combination, and somehow not break the user's flow while doing it.

Auth0 Token Vault eliminates that entire problem space.

The moment it clicked for me was when I wrapped my Gmail search tool with `withTokenVault({ connection: 'google-oauth2', scopes: ['gmail.readonly'] })` and realized I did not need to write a single line of token management code. No token storage. No refresh logic. No scope-checking middleware. When the user asks the agent to search their email and the credential does not exist yet, Token Vault raises an interrupt. The interrupt propagates from the server to the client. The client renders a consent popup. The user clicks "Authorize." The popup completes the OAuth flow. The popup closes. The original tool call resumes with the new credential. The agent shows the search results.

That entire flow -- the interrupt, the consent, the resume -- happens without losing conversation state. The user does not start over. The agent does not forget what it was doing. It just... asks, waits, and continues.

The harder lesson was `credentialsContext`. Google's OAuth lets you incrementally add scopes to an existing grant. GitHub does not. When I first configured the GitHub connection, tool calls would fail silently because Token Vault was trying to resolve credentials at session initialization time, before any tool had been invoked. Switching to `credentialsContext: 'tool-call'` fixed it -- credentials are now resolved at the moment the tool executes, which means the interrupt fires at exactly the right time. This is a one-line configuration change that took me hours to understand, and it represents the kind of nuance that makes the difference between a demo and a working product.

The CIBA integration was where the security model went from "nice to have" to "genuinely novel." When the agent wants to make a purchase, it does not just ask the user in the chat window -- it sends a push notification through Auth0 Guardian with a binding message: "Do you want to buy 2 AirPods?" The user approves on their phone. The agent proceeds. This is step-up authentication applied to agentic actions, and it establishes a pattern that I think will become standard: read operations get Token Vault consent, write operations get step-up auth, and high-risk operations get out-of-band confirmation.

The gap I kept running into is audit trails. I can show users which scopes are active and let them revoke connections. But there is no standard way to log "Agent X used gmail.readonly to search for 'invoice' at 14:32:07 and returned 3 results." Every agent platform will need this, and nobody has defined the schema for it yet. It is the missing layer between authorization (who can access what) and accountability (who did access what, when, and why).

Building Scope Lock changed how I think about the relationship between AI agents and user trust. The "grant everything" model treats authorization as a gate to get past. Progressive authorization treats it as a conversation. The agent explains what it needs. The user decides. The agent respects the decision. That is not just better security. That is better software.

---

# DELIVERABLE 3: 3-Minute Demo Video Script

---

## Demo Video Script (3:00)

### 0:00 - 0:15 | Hook

[Screen: Black screen, then fade into the Scope Lock login page with the Auth0 logo and "Scope Lock" title visible in the header]

"What if AI agents had to earn your trust, one permission at a time? Right now, every AI tool asks for all your permissions upfront -- Gmail, Calendar, GitHub, everything -- before it does a single thing. Scope Lock flips that model. The agent starts with zero access and requests each permission only when it actually needs it."

### 0:15 - 0:45 | App Overview and Progressive Authorization Concept

[Screen: Click "Login" and complete Auth0 authentication. Land on the chat page showing the empty state with the Scope Lock info card]

"This is Scope Lock -- a security-first AI assistant built on Auth0 Token Vault. It can connect to Gmail, Google Calendar, Google Tasks, GitHub, and Slack. But right now, it has access to none of them. Every connection, every scope, every permission has to be explicitly granted by me, in context, when the agent actually needs it."

[Screen: Highlight the info card text mentioning Auth0 Token Vault and Vercel AI SDK]

"Under the hood, Auth0 Token Vault acts as a credential broker. The agent never sees or stores a raw OAuth token. Every API call goes through Token Vault's federated token exchange."

### 0:45 - 1:30 | Live Demo -- Gmail Read

[Screen: Type "Show me my recent emails" into the chat input and press send]

"Let's see it in action. I'll ask the agent to show me my emails."

[Screen: The agent attempts to call the Gmail search tool. Token Vault detects the missing gmail.readonly scope. The TokenVaultInterruptHandler renders an "Authorization Required" card with an "Authorize" button]

"The agent tried to access Gmail, but it does not have permission yet. Token Vault detected the missing scope and raised an interrupt. I can see exactly what it is asking for -- read-only access to Gmail. Not compose, not delete -- just read."

[Screen: Click "Authorize." A popup opens showing Google's OAuth consent screen for gmail.readonly. Complete the consent flow. The popup closes automatically]

"I authorize the read-only scope. The OAuth flow happens in a popup. The agent's conversation state is preserved."

[Screen: The agent automatically retries the Gmail search tool call and streams back email results, rendered as clean markdown]

"And there it is -- the agent resumes exactly where it left off and shows me my emails. No page refresh. No lost context."

### 1:30 - 2:00 | Gmail Draft and Step-Up Auth

[Screen: Type "Draft a reply to the first email saying I'll review it by Friday" and press send]

"Now let's try a write operation. I'll ask the agent to draft an email."

[Screen: The agent attempts to call the Gmail draft tool. A new interrupt appears, this time requesting the gmail.compose scope]

"A separate authorization prompt -- because composing email is a different scope than reading email. The agent needs gmail.compose, which it does not have yet."

[Screen: Click "Authorize," complete the compose scope consent in the popup, popup closes, agent creates the draft]

"After I approve the compose scope, the agent creates the draft. Two separate permissions, two separate consent flows, each with clear context about what is being requested."

[Screen: Type "Buy me 2 AirPods" and press send. Show the CIBA flow triggering -- the agent sends an authorization request and the console shows the Guardian push notification being sent]

"For high-risk actions like purchases, Scope Lock goes further. It triggers CIBA -- Client-Initiated Backchannel Authentication. A push notification is sent to my phone asking me to confirm the purchase. The agent waits until I approve from my device."

### 2:00 - 2:30 | Profile Page -- Scope Visualization

[Screen: Click "Profile" in the navigation bar. The Profile page loads showing the User Info card and the Connected Accounts card side by side]

"The Profile page is where scope visibility lives. Every connected account is shown with its OAuth connection type, the exact scopes that have been granted, when the credential was created, and when it expires."

[Screen: Point to the Connected Accounts card showing google-oauth2 with gmail.readonly and gmail.compose scopes listed, plus creation and expiration timestamps]

"I can see that Google has gmail.readonly and gmail.compose scopes active. I can see exactly when each was granted. And if I want to revoke access..."

[Screen: Click the trash icon next to a connected account. Confirm the deletion dialog. The account disappears from the list]

"One click and it is gone. The agent loses access immediately."

### 2:30 - 2:50 | GitHub Integration

[Screen: Navigate back to Chat. Type "List my GitHub repositories" and press send]

"The same pattern works across every service. GitHub uses a different Token Vault configuration with per-tool-call credential resolution."

[Screen: The GitHub authorization interrupt appears. Click "Authorize," complete the GitHub OAuth flow in the popup, agent returns repository listing with names, descriptions, stars, and languages]

"Authorize the GitHub connection, and the agent lists my repositories -- names, descriptions, languages, star counts. Each service earns its access independently."

### 2:50 - 3:00 | Closing

[Screen: Split view showing the chat interface on the left with multiple successful tool calls, and the Profile page on the right showing all connected accounts with their scopes]

"Scope Lock. Five API integrations. Zero upfront permissions. Every scope requested in context, every action audited, every credential brokered through Auth0 Token Vault. Because AI agents should earn access -- not assume it."

[Screen: Fade to the Scope Lock logo with "Built with Auth0 Token Vault" underneath and the GitHub URL]
