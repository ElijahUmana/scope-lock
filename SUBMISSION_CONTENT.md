# Scope Lock -- Devpost Submission

---

# DELIVERABLE 1: Devpost Project Description

---

## Inspiration

Every AI agent integration today starts with the same dark pattern: "Grant access to your Gmail, Calendar, GitHub, and Slack." The user clicks "Allow All" because there is no alternative, and the agent immediately holds the keys to their entire digital life.

We asked a different question: **what if AI agents had to earn trust, one permission at a time -- and what if the entire authorization infrastructure enforced that at every layer?**

The principle of least privilege is foundational to security engineering, but it has been almost entirely absent from the AI agent ecosystem. Agents request maximum permissions upfront because the tooling makes progressive authorization hard. Auth0 Token Vault changes that equation -- it gives us a credential broker that can issue scoped tokens on demand, without the agent ever touching raw OAuth secrets.

Scope Lock exists to prove that progressive authorization is not just possible for AI agents -- it is architecturally superior. We built a risk-tiered policy engine, multi-agent credential isolation, branded consent experiences, a real-time audit trail, a security operations dashboard, and a full insights page documenting the patterns, pain points, and gaps we found -- all on top of Auth0 Token Vault and the Vercel AI SDK.

## What it does

Scope Lock is a security-first AI assistant with three specialized sub-agents, a risk-tiered policy engine, and a full security operations dashboard. It connects to Gmail, Google Calendar, Google Tasks, GitHub, and Slack while enforcing seven layers of authorization control:

**1. Multi-Agent Scope Isolation (3 Specialized Agents)**
The system deploys three agents with hard credential boundaries -- not prompt-level restrictions, but actual tool-level enforcement. The Reader Agent can access `gmailSearchTool`, `getCalendarEventsTool`, `getTasksTool`, and `getUserInfoTool`. The Writer Agent can access `gmailDraftTool` and `createTasksTool`. The Commerce Agent can access `shopOnlineTool`. Each agent is constructed with only its authorized tools passed to the LLM -- the Reader Agent physically cannot invoke `gmailDraftTool` because the tool does not exist in its execution context. This is real credential isolation enforced at the SDK layer, not prompt engineering.

**2. Risk-Tiered Policy Engine**
Every tool call is classified by a policy engine before execution. GREEN-tier operations (Gmail search, calendar reads, task listing) are auto-approved after Token Vault consent. AMBER-tier operations (email drafts, task creation) trigger elevated warnings. RED-tier operations (purchases) require CIBA step-up authentication via mobile push. The full policy rules table is visible in the Permission Dashboard so users can inspect the risk classification of every tool.

**3. Scope Presets / Privacy Modes**
Users can switch between three security postures: Lockdown (no tools available -- the agent cannot access any external service), Privacy (read-only tools only), and Productivity (full access including writes). Each preset gates which tools are passed to the LLM, enforcing least-privilege at the UI layer before any Token Vault interaction occurs.

**4. Active Scopes Bar (Real-Time Zero-Trust Display)**
A persistent bar in the chat interface shows the current authorization state. It starts in a zero-trust state: "No services authorized. The agent will request each permission as needed." As the user grants scopes, service icons appear with color-coded read/write indicators -- green for read-only, amber for write access. This gives users continuous visibility into exactly what the agent can access at any moment.

**5. Branded Authorization Cards**
Instead of Auth0's default generic popup, Scope Lock renders custom consent cards for every authorization request. Each card shows the service name and icon, the risk level (Read Only / Write Access / Elevated), a human-readable description of exactly what data will be accessed ("Read your email subjects, senders, and content"), and a security context note explaining that credentials are managed by Token Vault and the agent never sees raw tokens. This transforms the consent experience from a security gate into an informed decision.

**6. Progressive Authorization with Explanatory System Prompt**
The agent is instructed to explain every permission request before it happens. Before accessing Gmail, the agent says: "To check your emails, I'll need read-only access to your Gmail. This uses the gmail.readonly scope through Auth0 Token Vault." After completing the access, it confirms: "I retrieved your latest 10 emails using read-only Gmail access." For write operations, it explicitly warns about elevated privileges.

**7. Step-Up Authentication for High-Risk Actions (CIBA)**
Read-only operations require standard Token Vault consent. Write operations trigger AMBER-level warnings. But when the Commerce Agent attempts a purchase, the policy engine classifies it as RED and triggers CIBA -- Client-Initiated Backchannel Authentication sends a push notification through Auth0 Guardian to the user's device with a binding message like "Do you want to buy 2 AirPods?" The agent blocks until the user explicitly approves or denies from their phone. No silent financial transactions.

## How we built it

**Architecture:** Next.js 15 App Router with the Vercel AI SDK (`streamText`, `createUIMessageStream`, `withInterruptions`) for streaming tool-calling, powered by OpenAI GPT-4o. The frontend is a multi-agent chat interface with scope preset controls and real-time authorization state visualization.

**Multi-Agent Credential Isolation:** Three agent profiles are defined in `agents.ts`, each with an explicit `tools` array, `riskLevel`, and `credentialsContext` setting. The chat route filters the tool map by agent ID before passing it to `streamText` -- `Object.entries(allTools).filter(([name]) => allowedToolNames.includes(name))`. The LLM physically cannot call tools outside its agent boundary because they are not provided to the model.

**Risk-Tiered Policy Engine:** The `policy-engine.ts` module maps every tool name to a `PolicyRule` with a `RiskLevel` (GREEN/AMBER/RED), an `action` (auto-approve/warn-and-proceed/require-step-up), and a `requiredAuth` (none/consent/ciba). Every tool call passes through `evaluatePolicy()` before execution. Unknown tools default to AMBER for safety.

**Auth0 Token Vault Integration:** Each external service is wrapped with `auth0AI.withTokenVault()`, configuring the OAuth connection, required scopes, and credential lifecycle:

- `withGmailRead` -- `gmail.readonly`, `credentialsContext: 'thread'` (performance optimization for reads)
- `withGmailWrite` -- `gmail.compose`, `credentialsContext: 'tool-call'` (security isolation for writes)
- `withCalendar` -- `calendar.events`, `credentialsContext: 'thread'`
- `withGitHub` -- `credentialsContext: 'tool-call'` (GitHub does not support incremental scope grants)
- `withSlack` -- `channels:read`, `groups:read`, `credentialsContext: 'tool-call'`
- `withTasks` -- Google Tasks scope, `credentialsContext: 'thread'`

**credentialsContext as a Security Primitive:** Read operations use `credentialsContext: 'thread'` -- credentials are resolved at session initialization for performance. Write operations use `credentialsContext: 'tool-call'` -- credentials are resolved at the individual tool invocation level for security isolation. This is a deliberate architectural decision: reads are fast, writes are safe.

**Branded Authorization Cards:** The `TokenVaultInterruptHandler` component intercepts `TokenVaultInterrupt` objects, extracts the connection and `requiredScopes`, maps them to human-readable labels and risk levels, and renders a custom card with service branding, scope descriptions, risk classification, and a security context footer -- replacing the generic Auth0 consent popup.

**Active Scopes Bar:** The `ActiveScopesBar` component derives the current authorization state from the chat message history by scanning for tool-call message parts. It maps tool names to services and read/write levels, then renders a persistent status bar that transitions from zero-trust lockdown to progressively filled service indicators.

**Audit Trail:** Every tool call is logged with the tool name, scopes used, connection name, `credentialsContext` level, risk classification from the policy engine, timestamp, and success/failure status. The audit store is keyed by user ID and capped at 200 entries. Scope requests (granted, denied, pending) are tracked separately with a timeline visualization.

**Permission Dashboard:** A full security operations page featuring:
- Security Score (0-100) computed from active scope count, write scope presence, admin scope presence, and progressive authorization usage
- Connected services with scope badges classified as READ/WRITE/ADMIN with color coding
- Real-time audit trail table with tool icons, scope badges, timestamps, and success/failure indicators
- Scope request timeline with granted/denied/pending status dots
- Policy rules table showing every tool's risk classification, required action, and reason

**Scope Topology Visualization:** An interactive diagram showing Agent-to-Tool-to-Service boundaries with risk-level colored connections, displaying how credential flows are isolated across the multi-agent architecture.

**Insights Page:** A structured analysis of patterns discovered (progressive auth, credentialsContext tuning, risk-tiered policies, audit necessity), pain points (Google OAuth scope configuration, consent UX customization, CIBA channel setup, raw API response sanitization), gaps (no scope expiry, no per-agent boundaries in SDK, no built-in policy engine, no audit event standard), and six concrete recommendations for Auth0.

**CIBA for Async Authorization:** The `withAsyncAuthorization` wrapper implements Client-Initiated Backchannel Authentication for the Commerce Agent's `shopOnlineTool`. When triggered, it sends a push notification through Auth0 Guardian with a binding message, then polls for user approval before proceeding.

**Interrupt-Driven Consent Flow:** `withInterruptions` on the server and `useInterruptions` on the client form a bidirectional interrupt protocol. When Token Vault cannot fulfill a credential request, execution pauses, the interrupt propagates to the UI, the user completes consent via the branded authorization card, and execution resumes without losing conversation state.

## Challenges we ran into

**Multi-Agent Credential Isolation Without SDK Support.** The Auth0 AI SDK does not natively support per-agent credential boundaries. `credentialsContext` operates at the tool level, not the agent level. We solved this by filtering the tool map before passing it to `streamText` -- each agent profile declares its allowed tools, and only those tools are provided to the LLM. This is real enforcement: the Writer Agent cannot call `gmailSearchTool` because the tool object does not exist in its context. But this pattern should be a first-class SDK feature.

**Building a Policy Engine From Scratch.** There is no standard for risk-classifying tool calls in the agent ecosystem. We built a policy engine that maps every tool name to a risk level and required authentication method. This works, but it should be a framework feature -- every agent application needs this, and every developer is reinventing it.

**Google OAuth Scope Configuration for Token Vault.** Getting Google's OAuth consent screen to work correctly with Token Vault's incremental scope requests was the most time-consuming configuration challenge. Google treats certain scope combinations as incompatible, and the consent screen behavior changes based on whether the app is in testing or production mode. We had to carefully map which scopes could be requested together and which required separate connections.

**Branded Consent Card Engineering.** Auth0's default consent popup is functional but generic. Building a branded experience required reverse-engineering the `TokenVaultInterrupt` object structure to extract `connection`, `requiredScopes`, and resume metadata. We mapped every scope to human-readable labels, risk classifications, and data access descriptions. Better documentation and customization hooks from Auth0 would help.

**CIBA Channel Setup.** CIBA requires a configured push notification channel (Auth0 Guardian) and a registered device. The setup documentation is sparse, and debugging notification delivery required tracing through Guardian enrollment, the CIBA authorization request, and the token polling mechanism.

**credentialsContext Tuning.** Understanding when to use `'thread'` vs `'tool-call'` was critical. GitHub does not support incremental scope grants, so `'tool-call'` is mandatory. But read operations benefit from `'thread'`-level caching. Making the wrong choice causes either silent credential failures or unnecessary re-authorization prompts. This took hours to understand and represents a single-line configuration change with massive behavioral impact.

## Accomplishments that we're proud of

**Real multi-agent credential isolation.** Three agents with hard tool boundaries enforced at the SDK layer. The Reader Agent physically cannot call write tools. This is not prompt engineering -- it is architectural enforcement. We built what the SDK does not yet provide natively.

**A working risk-tiered policy engine.** Every tool call classified as GREEN (auto-approve), AMBER (warn), or RED (require step-up auth). The policy rules are visible in the dashboard. Unknown tools default to AMBER. This is the authorization pattern the industry needs but nobody has standardized.

**Branded authorization cards that build trust.** The custom consent experience shows service name, risk level, specific data access descriptions, and security context. Users see "Read your email subjects, senders, and content" instead of a generic "Grant access to Gmail." This transforms consent from a checkbox into an informed decision.

**Active Scopes Bar showing zero-trust progression.** The real-time display starts locked ("No services authorized"), then progressively fills with color-coded service indicators as scopes are granted. Users have continuous visibility into their agent's authorization state.

**Permission Dashboard with security scoring.** A full security operations view: computed security score, connected services with READ/WRITE/ADMIN scope badges, real-time audit trail, scope request timeline, policy rules table, and scope topology diagram. This is the transparency that every AI agent should provide.

**Insights page with concrete recommendations for Auth0.** We documented every pattern, pain point, and gap we found. Six actionable recommendations: scope expiry, per-agent credential boundaries, built-in policy engine, audit event schema, consent customization hooks, and embeddable dashboard widgets. This is a genuine technical contribution to the Auth0 ecosystem.

**credentialsContext as a deliberate security architecture.** Read operations use `'thread'` for performance. Write operations use `'tool-call'` for isolation. This is not accidental -- it is a conscious security/performance tradeoff that should be documented as a best practice.

**Zero-credential agent architecture.** The AI agent never sees, stores, or transmits a raw OAuth token. Every credential flows through Token Vault's federated exchange. If the agent's memory is compromised, there are no secrets to leak.

## What we learned

**credentialsContext is the most underrated security primitive in the SDK.** The difference between `'thread'` and `'tool-call'` determines whether credentials are cached across tool invocations or isolated per-call. Read operations should use `'thread'` for performance. Write operations must use `'tool-call'` for security. This single configuration option has more security impact than any other setting.

**Multi-agent isolation requires enforcement, not instructions.** Telling an LLM "you are the Reader Agent, do not write" is prompt engineering. Removing write tools from its execution context is enforcement. The Auth0 AI SDK does not natively support per-agent credential boundaries -- `credentialsContext` operates at the tool level. We built agent-level isolation by filtering tool maps, but this should be a first-class SDK feature.

**Risk classification of tool calls should be a framework feature.** We built a policy engine that maps every tool to GREEN/AMBER/RED. This is not application-specific -- it is a universal need. Every agent application needs to distinguish between reads, writes, and destructive operations. Auth0 should ship a `PolicyEngine` class in `@auth0/ai`.

**Progressive authorization is a UX innovation, not just a security measure.** Users who see each permission requested with a clear explanation feel more in control than users who see a wall of checkboxes. The branded authorization cards with risk levels and data access descriptions produce higher trust than generic OAuth popups.

**The audit trail gap is real.** We log every tool call with scopes, connection, credentialsContext, risk level, and outcome. But there is no industry standard for this. Auth0 should define an `AuditEvent` schema for agent authorization logging.

**Scope expiry is the missing security feature.** Once a scope is granted via Token Vault, it persists until manual revocation. Time-bound scopes ("grant gmail.readonly for 1 hour") would significantly improve security posture. This is the single most impactful feature Auth0 could add.

## What's next for Scope Lock

**Auth0 FGA for Document-Level Access Control.** The FGA integration is scaffolded -- we want fine-grained authorization at the individual resource level (specific Google Docs, specific GitHub repos), not just the API level.

**MCP Server Authentication.** As Model Context Protocol becomes the standard for agent-tool communication, Scope Lock's progressive authorization pattern needs to work with MCP's authentication flow. Token Vault-backed MCP auth is the logical next step.

**Time-Bound Scopes.** Implementing automatic scope expiry and re-authorization, so that a `gmail.readonly` grant expires after a configurable window and the agent must re-request consent.

**NPM Package for Progressive Authorization.** The multi-agent isolation + policy engine + branded consent + audit trail pattern is reusable. We want to extract it into a standalone package that any Vercel AI SDK project can use.

## Built With

auth0, nextjs, vercel-ai-sdk, typescript, openai, gpt-4o, tailwindcss, token-vault, ciba, oauth2, react, drizzle-orm, postgres, lucide-react

---

# DELIVERABLE 2: Bonus Blog Post

---

## Bonus Blog Post

### What We Actually Learned Building a Risk-Tiered Policy Engine for AI Agent Authorization

I built an AI agent system with three specialized sub-agents, a policy engine that classifies every tool call by risk level, branded consent cards, and a full security operations dashboard. The most important thing I learned is that the authorization primitives we need for agentic AI do not fully exist yet -- but Auth0 Token Vault gets us closer than anything else.

The architecture starts with a principle: not all tool calls are equal. Searching Gmail is not the same as drafting an email, which is not the same as buying something. So we built a policy engine that classifies every tool as GREEN (read-only, auto-approve after consent), AMBER (write operation, warn and proceed with elevated consent), or RED (financial/destructive, require CIBA step-up authentication via mobile push). This three-tier model maps cleanly to real user expectations about what an AI agent should be able to do without asking versus what requires explicit approval.

The multi-agent credential isolation was the hardest problem. We deploy three agents: Reader (gmail search, calendar, tasks), Writer (email drafts, task creation), and Commerce (purchases). The critical insight is that prompt-level instructions ("you are the Reader Agent, do not write") are not security -- they are suggestions. An adversarial prompt can bypass them. Real isolation means the Reader Agent's execution context does not contain write tools at all. We filter the tool map by agent ID before passing it to the Vercel AI SDK's `streamText`. The LLM cannot call `gmailDraftTool` from the Reader Agent because the function does not exist in its scope. This is enforcement, not instruction.

Auth0 Token Vault is what makes this architecture feasible. Each tool is wrapped with `withTokenVault()` specifying the OAuth connection, required scopes, and a `credentialsContext` setting. This last parameter is the most underrated security primitive in the entire SDK. Setting it to `'thread'` means credentials are resolved once per session -- fast, but the credential persists across tool calls. Setting it to `'tool-call'` means credentials are resolved fresh at each invocation -- slower, but each write operation gets its own isolated credential. We deliberately use `'thread'` for all read operations and `'tool-call'` for all write operations. This is not a performance optimization. It is a security architecture.

The branded authorization cards replaced Auth0's generic consent popup. When Token Vault raises a `TokenVaultInterrupt`, we intercept it, extract the `connection` and `requiredScopes`, map them to human-readable labels and risk classifications, and render a custom card showing the service name, risk level badge, specific data access description ("Read your email subjects, senders, and content"), and a security note about Token Vault credential management. This transforms consent from "click Allow to continue" into an informed decision where the user understands what data the agent will access and at what risk level.

The gaps we found are real and worth documenting. First: there is no scope expiry in Token Vault. Once granted, a scope persists until manual revocation. Time-bound scopes would be a significant security improvement. Second: the Auth0 AI SDK does not support per-agent credential boundaries. `credentialsContext` is per-tool, not per-agent. We built agent isolation at the application layer, but it should be a first-class SDK feature. Third: there is no built-in policy engine. Risk classification of tool calls is a universal need, not application-specific. Fourth: there is no standard audit event schema for agent authorization. We log every tool call with scopes, connection, credentialsContext, risk level, and outcome -- but every developer is inventing this schema independently.

The Permission Dashboard ties it all together: a computed security score (0-100), connected services with READ/WRITE/ADMIN scope badges, a real-time audit trail, a scope request timeline, and a policy rules table showing every tool's risk classification. This is what agent authorization visibility should look like.

Building Scope Lock changed how we think about the boundary between an AI agent and the services it accesses. Token Vault handles credential brokering. What is still missing is the policy layer (what should the agent be allowed to do?), the isolation layer (how do we prevent one agent from accessing another agent's credentials?), and the accountability layer (who accessed what, when, and with what authority?). We built all three. Auth0 should ship them as platform features.

---

# DELIVERABLE 3: 3-Minute Demo Video Script

---

## Demo Video Script (3:00)

### 0:00 - 0:12 | Hook

[Screen: Black screen, then fade into the Scope Lock login page]

"Every AI agent asks for all your permissions upfront. Scope Lock takes the opposite approach -- three specialized agents, a risk-tiered policy engine, and zero permissions until you grant them one by one. Let me show you what that looks like."

### 0:12 - 0:35 | Zero-Trust Start State and Scope Presets

[Screen: Log in via Auth0. Land on the chat page showing the agent selector with three agents: Reader, Writer, Commerce. The Active Scopes Bar reads "Zero Trust -- No services authorized."]

"Three agents, each with isolated credential boundaries. The Reader Agent can only call read tools. The Writer Agent can only call write tools. The Commerce Agent only handles purchases. This is not prompt engineering -- these are hard boundaries enforced at the SDK layer."

[Screen: Show the Scope Preset Selector above the chat. Click through Lockdown (red), Privacy (green), Productivity (amber)]

"Scope Presets let me control the agent's access posture. Lockdown disables all tools. Privacy allows read-only. Productivity unlocks everything. I'll start in Privacy mode."

### 0:35 - 1:10 | Progressive Authorization -- Gmail Read

[Screen: Select the Reader Agent. Type "Show me my recent emails" and send]

"I'll ask the Reader Agent for my emails. Watch what happens."

[Screen: The agent explains it needs gmail.readonly. Then the branded authorization card appears -- showing the Google service icon, "Read Only" risk badge, "Gmail Read" scope, and the description "Read your email subjects, senders, and content." The security footer reads "Credentials are managed by Auth0 Token Vault. The AI agent never sees your raw tokens."]

"Instead of a generic popup, you get a branded authorization card. It shows exactly which service, which scope, the risk level, and what data will be accessed. This is informed consent."

[Screen: Click "Authorize Google Access." Complete the Google OAuth flow in the popup. The popup closes. The Active Scopes Bar updates -- a green "Gmail" pill appears with a lock icon indicating read-only access]

"After I authorize, watch the Active Scopes Bar -- it just went from zero trust to showing Gmail with a read-only indicator. The agent resumes and shows my emails."

[Screen: Agent streams back formatted email results]

### 1:10 - 1:40 | Agent Switching and Write Operations

[Screen: Switch to the Writer Agent using the agent selector. The agent card shows amber border and "MEDIUM" risk badge]

"Now I switch to the Writer Agent. Notice the amber risk indicator -- this agent handles write operations."

[Screen: Type "Draft a reply to the latest email saying I'll review it Friday" and send]

[Screen: A new branded authorization card appears -- this time showing "Write Access" in amber, with "Gmail Write" scope and description "Create and send email drafts on your behalf"]

"A separate authorization card for the compose scope. Amber badge -- write access. Different scope, different consent, different risk level."

[Screen: Authorize. The Active Scopes Bar updates -- Gmail pill changes from green (read) to amber (write). The RiskBadge component shows "Write Operation -- Elevated Access" inline with the tool call]

"The scopes bar shows Gmail upgraded to write access. And the risk badge right in the chat confirms this was an AMBER-tier operation."

### 1:40 - 2:05 | CIBA Step-Up for Purchases

[Screen: Switch to the Commerce Agent. Card shows red border and "HIGH" risk badge]

"The Commerce Agent is RED-tier. Every action requires step-up authentication."

[Screen: Type "Buy me 2 AirPods" and send. The agent explains it will trigger CIBA. The RiskBadge shows "High Risk -- Step-up Auth Required" in red. The CIBA flow triggers -- "Waiting for approval on your device..."]

"CIBA sends a push notification to my phone through Auth0 Guardian. The agent blocks until I explicitly approve. No silent purchases."

[Screen: Show the Guardian push notification on a phone mockup with "Do you want to buy 2 AirPods?" binding message. Tap Approve]

"Approved on my device. The agent confirms the purchase."

### 2:05 - 2:40 | Permission Dashboard

[Screen: Navigate to the Permission Dashboard. The Security Score ring animates to show a score (e.g., 75). Connected services show Google with READ and WRITE scope badges, color-coded green and amber]

"The Permission Dashboard is a full security operations view. Security score out of 100, computed from your active scopes -- fewer scopes, higher score."

[Screen: Scroll to the Audit Trail section showing tool calls with icons, scope badges, timestamps, and OK/Fail status. Then scroll to the Scope Request Timeline showing granted/denied dots on a vertical timeline]

"Every tool call logged in the audit trail -- tool name, scopes used, risk classification, timestamp. The scope request timeline tracks every authorization flow."

[Screen: Scroll to the Policy Rules table showing GREEN/AMBER/RED classifications for each tool]

"The policy rules table. Every tool, its risk tier, and what action is required. Full transparency."

### 2:40 - 2:55 | Insights Page

[Screen: Navigate to the Insights page. Show the four sections: Patterns Discovered, Pain Points, Gaps Identified, Recommendations for Auth0]

"The Insights page documents everything we learned. Patterns like credentialsContext tuning. Pain points like Google OAuth configuration. Gaps -- no scope expiry, no per-agent boundaries in the SDK, no built-in policy engine. And six concrete recommendations for Auth0."

### 2:55 - 3:00 | Closing

[Screen: Split view -- chat with Active Scopes Bar filled on left, Dashboard with security score and topology on right]

"Scope Lock. Three isolated agents. A risk-tiered policy engine. Branded consent. Full audit trail. Zero upfront permissions. Because AI agents should earn access, not assume it."

[Screen: Fade to Scope Lock logo with "Built with Auth0 Token Vault" and the GitHub URL]
