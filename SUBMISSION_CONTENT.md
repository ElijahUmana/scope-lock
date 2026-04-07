# Scope Lock -- Devpost Submission

---

# DELIVERABLE 1: Devpost Project Description

---

## Inspiration

Every AI agent integration today follows the same dark pattern: "Grant access to your Gmail, Calendar, GitHub, and Slack." The user clicks "Allow All" because there is no alternative, and the agent immediately holds the keys to their entire digital life.

We asked a different question: **what if AI agents had to earn trust, one permission at a time -- and what if the entire authorization infrastructure enforced that at every layer?**

The principle of least privilege is foundational to security engineering, but it has been almost entirely absent from the AI agent ecosystem. Agents request maximum permissions upfront because the tooling makes progressive authorization hard. Auth0 Token Vault changes that equation -- it provides a credential broker that can issue scoped tokens on demand, without the agent ever touching raw OAuth secrets.

But Token Vault alone is not enough. An agent that can request any scope, call any tool, and chain any credential escalation is still dangerous. What the ecosystem lacks is the enforcement layer on top of Token Vault: per-agent tool isolation, risk classification of every tool call, anomaly detection, tamper-proof audit trails, automatic scope expiry, rate limiting, and cryptographically signed delegation chains.

Scope Lock exists to prove that all of this can be built today. We implemented a production-grade authorization framework for AI agents -- not just a demo, but a complete security architecture with 300 automated tests proving it works.

## What it does

Scope Lock is an **Email Triage Agent** -- a security-first AI assistant that helps busy professionals triage their inbox, manage their schedule, and stay on top of follow-ups. It connects to Gmail, Google Calendar, and Google Tasks through 8 tools (4 reader + 4 writer) while enforcing **multiple layers of authorization control** through two operating modes, a risk-tiered policy engine, and a full security operations dashboard.

**The hero experience is Progressive Mode** -- a single unified agent that starts with zero permissions and earns each scope inline through branded consent cards. After triaging emails, it suggests cross-service follow-ups (check calendar, create task, draft reply) that each require a new scope grant, demonstrating progressive expansion across Google services. Quick action buttons let users start immediately.

**1. Email Triage Agent -- Domain-Specific Use Case**
The system prompt is purpose-built for email triage. When asked to help with emails, the agent searches for recent messages, categorizes them (URGENT / ACTION / INFORMATIONAL / LOW PRIORITY), suggests actions (Reply, Forward, Create Task, Archive), and only requests write scope escalation when the user wants to act on a specific email. After presenting the triage report, the agent always suggests cross-service follow-ups: check calendar for meetings mentioned in emails, create tasks for items needing follow-up, and draft replies to urgent messages. Each suggestion requires granting a new scope, demonstrating progressive authorization across services in a single conversation.

**2. Multi-Agent Scope Isolation (Reader / Writer) -- Strict Isolation Mode**
Two agents with hard credential boundaries enforced at the tool-filtering layer -- not prompt-level restrictions. The Reader Agent can access `gmailSearchTool`, `getCalendarEventsTool`, `getTasksTool`, and `getUserInfoTool`. The Writer Agent can access `gmailDraftTool`, `createTasksTool`, `deleteTaskTool`, and `completeTaskTool`. Each agent is constructed with only its authorized tools passed to the LLM via `Object.entries(tools).filter(([name]) => allowedToolNames.includes(name))`. The Reader Agent physically cannot invoke `gmailDraftTool` because the tool does not exist in its execution context. This is real credential isolation enforced at the SDK layer, not prompt engineering.

**3. Risk-Tier Policy Engine (GREEN / AMBER / RED)**
Every tool call is classified by a policy engine before execution. GREEN-tier operations (Gmail search, calendar reads, task listing, user info) are auto-approved after Token Vault consent. AMBER-tier operations (email drafts, task creation, task deletion, task completion) trigger elevated warnings. RED-tier operations require CIBA step-up authentication via mobile push. Unknown tools default to AMBER for safety. The full policy rules table is visible in the Dashboard so users can inspect the risk classification of every tool. The engine covers all 8 active tools: 4 GREEN + 4 AMBER.

**4. Scope Presets (Lockdown / Privacy / Productivity)**
Users can switch between three security postures: **Lockdown** (no tools available -- the agent cannot access any external service), **Privacy** (4 read-only tools only), and **Productivity** (all 8 tools including writes). Each preset gates which tools are passed to the LLM. The Lockdown preset passes an empty tool array. The Privacy preset passes only GREEN-tier tools. Tools must pass both the agent filter AND the preset filter -- the intersection enforces double least-privilege at the UI layer before any Token Vault interaction occurs.

**5. Progressive Authorization with Branded Consent Cards**
Instead of Auth0's default generic popup, Scope Lock renders custom consent cards for every authorization request. Each card shows the service name and icon, the risk level (Read Only / Write Access / Elevated), a human-readable description of exactly what data will be accessed ("Read your email subjects, senders, and content"), and a security context note explaining that credentials are managed by Token Vault and the agent never sees raw tokens. The `TokenVaultInterruptHandler` intercepts `TokenVaultInterrupt` objects, extracts the `connection` and `requiredScopes`, and maps them to branded UI.

**6. Active Scopes Bar with Zero-Trust Start**
A persistent bar in the chat interface shows the current authorization state. It starts in a zero-trust state: "No services authorized. The agent will request each permission as needed." As the user grants scopes, service icons appear with color-coded read/write indicators -- green for read-only, amber for write access. The bar derives state from the chat message history by scanning for tool-call message parts.

**7. credentialsContext Tuning as a Security Architecture**
Read operations use `credentialsContext: 'thread'` -- credentials are resolved at session initialization for performance. Write operations (Gmail drafts, task deletion, task completion) use `credentialsContext: 'tool-call'` -- credentials are resolved fresh at each invocation for security isolation. This is not a performance optimization -- it is a deliberate security architecture. Each `withTokenVault()` call explicitly configures this setting.

**8. SHA-256 Hash-Chained Audit Trail (Tamper-Proof)**
Every tool call is logged with tool name, scopes used, connection, `credentialsContext`, risk level, timestamp, success/failure, and a SHA-256 hash computed from the entry payload concatenated with the previous entry's hash. The chain starts from a genesis hash (`0` x 64). The `verifyAuditChain()` function walks the entire chain and detects any tampered entry by recomputing the expected hash at each position. The audit verification endpoint (`/api/audit/verify`) exposes this as an API. The chain is append-only -- entries cannot be modified or deleted without breaking the cryptographic chain.

**9. Anomaly Detection Engine**
The anomaly detector analyzes the audit trail after every tool call and flags four pattern types: **RAPID_ESCALATION** (GREEN to RED within 60 seconds -- possible automated privilege escalation), **HIGH_FREQUENCY** (>10 tool calls per minute -- possible automated abuse), **SCOPE_HOPPING** (3+ distinct connections within 30 seconds -- rapid service switching), and **UNUSUAL_SCOPE** (first-time tool access after a baseline of 5+ calls -- novel tool usage). Each alert has a severity level (low/medium/high) and is displayed in the Dashboard's Anomaly Alerts panel.

**10. Scope TTL Auto-Expiration**
Every scope grant has a time-to-live based on its risk level: GREEN scopes expire after 30 minutes, AMBER scopes after 10 minutes, RED scopes after 5 minutes. The `checkScopeExpiry()` function returns validity status and remaining time. The Scope Expiry dashboard panel shows countdown timers for every active grant. When a grant expires, the agent must re-request authorization -- no indefinite credential persistence.

**11. Per-Agent Rate Limiting**
Tool calls are rate-limited per agent, tuned by risk level: Reader Agent gets 50 calls per 5 minutes (reads are safe), Writer Agent gets 15 (writes mutate state), default gets 30. The rate limiter tracks calls in a sliding window per `userId:agentId` pair. When the limit is exceeded, the call is blocked and the remaining cooldown is returned. The chat UI shows a rate-limit indicator when approaching the threshold.

**12. Agent Delegation with Cryptographic Chains**
When a user switches between agents (Reader to Writer), each transition is recorded as a `DelegationRequest` with a SHA-256 hash of the delegation payload (from-agent, to-agent, tools requested, timestamp). The chain is append-only, creating a verifiable, tamper-evident trail of every privilege escalation during the session. The Delegation Chain dashboard panel visualizes the flow with agent nodes, hash-annotated arrows, risk escalation badges, and approval status.

**13. Rich Authorization Requests (RFC 9396)**
The `auth0-rar.ts` module implements Rich Authorization Requests per RFC 9396 for structured, machine-readable authorization details. Instead of flat binding messages, RAR includes transaction type, actions, resource locations, instructed amounts with currency, creditor names, and account identifiers. This enables PSD2-compliant audit trails and Open Banking interoperability.

**14. Auth0 Actions Showcase (Post-Login + Token Exchange)**
Two Auth0 Actions are implemented and displayed as reference code. The **Post-Login Action** enriches the ID token with custom claims under the `https://scopelock.dev` namespace -- connected-account count, agent access list, scope-grant count, and last-login timestamp. The **Token Exchange Action** runs during Token Vault credential exchanges -- it logs every exchange attempt for audit and blocks high-risk scopes (gmail.compose, gmail.send, product:buy) unless step-up authentication was completed within a 5-minute window.

**15. Connected Accounts Management**
The Profile page provides full Connected Accounts management via the Auth0 Management API. Users can view all federated identity providers linked to their account (Google, GitHub, Slack), see connection metadata and linked-at timestamps, and delete individual connected accounts. This gives users direct control over which identity providers are linked -- complementing the scope-level revocation in the dashboard with account-level disconnection.

**16. Token Vault with credentialsContext**
Each tool wrapped with `auth0AI.withTokenVault()` explicitly configures its credential lifecycle. The Token Vault integration across four Google connections (Gmail read, Gmail write, Calendar, Tasks) demonstrates two `credentialsContext` modes: `'thread'` for read operations (shared within conversation for performance) and `'tool-call'` for write operations like draft creation, task deletion, and task completion (isolated per invocation for security). This deliberate per-connection tuning is the core security/performance architecture.

**17. Security Operations Dashboard**
A full security operations page with seven panels:
- **Security Score Gauge** (0-100) computed from active scope count, write scope presence, admin scope presence, and progressive authorization usage
- **Scope Topology Visualization** -- interactive diagram showing Agent-to-Tool-to-Service boundaries with risk-level colored connections
- **Token Lifecycle Panel** -- token presence indicators (ID/Access/Refresh), expiry countdown, credential context distribution across connections
- **JWT Token Inspector** -- decoded ID token claims table (issuer, subject, audience, expiry, scopes) with live expiry countdown, token presence indicators, and security note about raw tokens
- **Scope Analytics** (pure CSS charts) -- total API calls, read/write ratio with conic-gradient donut chart, average risk score, top service usage, time-bucketed stacked bar charts for scope usage over time, service breakdown with horizontal stacked bars, credential context distribution bar
- **Consent History Timeline** -- alternating left/right timeline with event cards showing granted/denied/pending/revoked/expired status, service icons, scope badges, inferred agent, and relative timestamps; responsive mobile layout with single-column timeline
- **Policy Rules Table** showing every tool's risk classification, required action, and reason; plus Anomaly Alerts panel, Scope Expiry panel with countdown timers, and Delegation Chain panel with cryptographic flow visualization

**18. Security Sandbox with Real Test Execution**
The Security page includes a sandbox that runs 14 automated security assertions against the live system. Assertions are grouped into four categories: **Isolation** (Reader cannot access write tools, Writer cannot access read tools, Reader cannot access create tools, Lockdown has zero tools, Privacy has only read tools), **Policy** (read tools classified GREEN, write tools classified AMBER, task creation classified AMBER, unknown tools default to AMBER), **Credential** (Gmail read uses thread-scoped credentials, Gmail write uses per-call isolation), and **Audit** (audit store is functional, audit entries include risk level). Results render with expandable detail rows, category pass/fail counters, and a summary banner. These are real tests executing against real modules -- not mocked.

**19. Authorization Matrix**
A visual cross-reference matrix showing which tools each agent can access under each scope preset. Cells are color-coded by risk level (GREEN/AMBER/RED) and marked with check/lock icons to show access vs. denial. This makes the full authorization policy visible at a glance.

**20. 300 Automated Tests Across 12 Test Files + 14 Security Assertions**
300 unit and integration tests across 12 test files covering chat route integration (49 tests), agent-preset matrix (44), policy engine (38), agents (31), Gmail parser (23), audit trail (21), scope TTL (19), scope resolver (19), scope presets (19), anomaly detection (16), rate limiter (14), and scope presets integration (7). Plus 14 live security assertions in the sandbox. Total: 314 automated quality checks.

**21. Quick Action Buttons and Cross-Service Suggestions**
The welcome message includes contextual quick action cards that differ by mode: Progressive Mode shows "Triage Inbox", "Today's Schedule", "My Tasks", and "Draft Email"; Reader shows "Triage Inbox", "Today's Schedule", "My Tasks"; Writer shows "Draft Email", "Create Task", "Compose Message". Clicking a card immediately sends the prompt. After triage, the agent always suggests specific cross-service follow-ups referencing actual email content -- check calendar for a mentioned meeting, create a task for an action item, draft a reply to the most urgent email. Each suggestion requires a new scope grant, demonstrating progressive expansion.

**22. Demo Data Seeding for First-Time Dashboard Visitors**
The `/api/seed-demo` endpoint seeds realistic data so the dashboard is not empty on first visit: 10 audit trail entries spanning ~55 minutes (Gmail reads, Calendar views, Task reads, draft creation, task creation), 4 scope request timeline entries (gmail.readonly, calendar.events, tasks, gmail.compose), and a Reader-to-Writer delegation chain. All entries are tagged with `[demo]` prefix to distinguish from real activity.

**23. Onboarding Overlay**
A four-step guided walkthrough for first-time users explaining: (1) zero-trust start -- the agent begins with zero permissions, (2) progressive authorization -- scopes are earned one at a time with branded consent cards, (3) scope presets -- Lockdown/Privacy/Productivity control the maximum capability, (4) security dashboard -- audit trail, anomaly detection, and scope expiry monitoring. Persisted via localStorage so it only shows once.

**24. Popup Timeout and Cancel Handling**
The consent popup includes a 60-second countdown timer with auto-expiry. If the user does not complete authorization within 60 seconds, the popup closes automatically and shows a "timed out" state with a Retry button. Users can cancel/dismiss the authorization at any time. Popup-blocked detection shows an error with a Try Again button. The `TokenVaultConsentPopup` component manages idle, waiting, popup-blocked, and timed-out states.

**25. /chat Redirect**
The `/chat` route redirects to `/` since the chat interface is the home page for authenticated users. The `/matrix`, `/sandbox`, and `/insights` routes redirect to their respective `/security` tabs.

**26. Error Boundaries and Responsive Design**
Every page wraps its content in React error boundaries with recovery buttons. The Dashboard, Security, Profile, and Chat pages all use `<ErrorBoundary pageName="...">`. The entire UI is mobile responsive -- the consent timeline switches from alternating desktop layout to single-column mobile layout, the dashboard grid adapts from multi-column to single-column, and the navigation collapses for mobile viewports.

## How we built it

**Architecture:** Next.js 15 App Router with the Vercel AI SDK (`streamText`, `createUIMessageStream`, `withInterruptions`) for streaming tool-calling, powered by OpenAI GPT-4o. The frontend supports two modes: Progressive Mode (default, single unified agent) and Strict Isolation Mode (Reader + Writer agents with hard tool boundaries). Both modes include scope preset controls, an active scopes bar, quick action buttons, and real-time authorization state visualization.

**Multi-Agent Credential Isolation:** Two agent profiles are defined in `agents.ts`, each with an explicit `tools` array, `riskLevel`, `credentialsContext` setting, `canDelegateTo` list, and `cannotAccess` list. The chat route filters the tool map by agent ID before passing it to `streamText`. A second filter layer applies the active scope preset, creating a double intersection: `(agent tools) AND (preset tools)`. The LLM physically cannot call tools outside both boundaries. In Progressive Mode (no agentId), the preset filter alone determines tool access.

**Risk-Tiered Policy Engine:** The `policy-engine.ts` module maps every tool name to a `PolicyRule` with a `RiskLevel` (GREEN/AMBER/RED), an `action` (auto-approve/warn-and-proceed/require-step-up), and a `requiredAuth` (none/consent/ciba). All 8 active tools are classified: 4 GREEN (reader tools) + 4 AMBER (writer tools). Every tool call passes through `evaluatePolicy()` before execution. Unknown tools default to AMBER for safety.

**Auth0 Token Vault Integration:** Each external service is wrapped with `auth0AI.withTokenVault()`, configuring the OAuth connection, required scopes, and credential lifecycle:

- `withGmailRead` -- `gmail.readonly`, `credentialsContext: 'thread'`
- `withGmailWrite` -- `gmail.compose`, `credentialsContext: 'tool-call'`
- `withCalendar` -- `calendar.events`, `credentialsContext: 'thread'`
- `withTasks` -- Google Tasks, `credentialsContext: 'thread'` (read) / `credentialsContext: 'tool-call'` (delete, complete)

**CIBA for Async Authorization:** The `withAsyncAuthorization` wrapper implements Client-Initiated Backchannel Authentication for RED-tier operations. When triggered, it sends a push notification through Auth0 Guardian with a binding message, then blocks until the user explicitly approves or denies from their phone.

**SHA-256 Audit Chain:** The `audit.ts` module computes each entry's hash as `SHA256(previousHash:toolName:scopes:timestamp:success:riskLevel:connection)`. The chain starts from a genesis hash of 64 zeroes. `verifyAuditChain()` walks every entry and recomputes expected hashes, returning the exact index of any break.

**Anomaly Detection:** The `anomaly-detection.ts` module runs four detection functions after every audit entry: rapid escalation (GREEN to RED within 60s), high frequency (>10 calls per 60s), scope hopping (3+ connections within 30s), and unusual scope (first-time tool use after baseline). Alerts are stored per-user and capped at 100.

**Scope TTL:** The `scope-ttl.ts` module manages time-bound scope grants with `grantScope()`, `checkScopeExpiry()`, `getActiveGrants()`, `revokeExpiredScopes()`, and `renewGrant()`. TTL values: GREEN=30 min, AMBER=10 min, RED=5 min.

**Rate Limiting:** The `rate-limiter.ts` module implements per-agent sliding-window rate limits: Reader=50/5min, Writer=15/5min, default=30/5min. The `checkRateLimit()` function increments and checks in one atomic operation. `getRateLimitStatus()` provides a peek without incrementing.

**Agent Delegation:** The `agent-orchestrator.ts` module creates SHA-256-hashed `DelegationRequest` entries when users switch agents, building an append-only cryptographic chain. Each delegation records from-agent, to-agent, tools requested, risk escalation, timestamp, hash, and approval status.

**Dashboard:** Pure CSS visualizations -- conic-gradient donut charts for read/write ratio, stacked bar charts for time-bucketed scope usage, horizontal stacked bars for service breakdown, and a credential context distribution bar. No charting library dependencies. The scope topology uses absolute-positioned SVG-like layout with CSS grid.

## Challenges we ran into

**Multi-Agent Credential Isolation Without SDK Support.** The Auth0 AI SDK does not natively support per-agent credential boundaries. `credentialsContext` operates at the tool level, not the agent level. We solved this by filtering the tool map before passing it to `streamText` -- each agent profile declares its allowed tools, and only those tools are provided to the LLM. In Progressive Mode, the same filtering applies through scope presets. This pattern should be a first-class SDK feature.

**Building a Tamper-Proof Audit Chain.** Standard logging writes entries and forgets them. We needed an audit trail where any modification to any entry is detectable. The SHA-256 hash chain approach means each entry's hash depends on the previous entry's hash, so modifying entry N invalidates every entry from N onward. This required careful handling of the genesis hash, entry ordering, and serialization consistency.

**Anomaly Detection Threshold Tuning.** Setting the right thresholds for rapid escalation (60s window), high frequency (10 calls/min), and scope hopping (3 connections/30s) required balancing false positives against real attack detection. Too aggressive and normal email triage triggers alerts. Too lenient and automated abuse goes undetected.

**Scope TTL Without Token Vault Support.** Token Vault does not support time-bound scope grants natively. We implemented TTL at the application layer, which means expired grants are enforced client-side but Token Vault's cached credentials may still be valid server-side. True scope expiry requires Token Vault integration.

**credentialsContext Tuning.** Understanding when to use `'thread'` vs `'tool-call'` was critical. Read operations benefit from `'thread'`-level caching for performance. Write operations (drafts, task deletion, task completion) must use `'tool-call'` for per-invocation isolation. Making the wrong choice causes either silent credential failures or unnecessary re-authorization prompts. This single-line configuration change has massive behavioral impact.

**Pure CSS Dashboard Charts.** We deliberately avoided charting libraries to keep the bundle size minimal. Every chart -- donut, stacked bar, horizontal bar, distribution bar -- is built with CSS conic-gradient, flexbox, and inline styles. This required manual percentage calculations, color interpolation, and responsive breakpoint handling.

## Accomplishments that we're proud of

**A complete authorization framework, not just a demo.** Scope Lock implements Progressive Mode as the hero experience (zero-trust start, branded consent cards with data access and TTL, cross-service follow-up suggestions, quick action buttons) plus Strict Isolation Mode with hard multi-agent credential boundaries. On top of both modes: risk-tier policy engine, scope presets, SHA-256 audit chain, anomaly detection, scope TTL, rate limiting, cryptographic delegation chains, demo data seeding, and onboarding overlay. Each layer is independently testable and independently useful.

**314 automated quality checks.** 300 unit and integration tests across 12 test files plus 14 live security assertions that execute against real modules. The tests cover chat route integration (49), agent-preset matrix (44), policy engine (38), agent isolation (31), Gmail parsing (23), audit chain (21), scope TTL (19), scope resolver (19), scope presets (19), anomaly detection (16), rate limiter (14), and cross-cutting integration scenarios (7).

**A tamper-proof audit trail with real cryptographic verification.** Every audit entry is SHA-256 hash-chained to the previous entry. The `verifyAuditChain()` function walks the entire chain and pinpoints the exact index of any tampering. The `/api/audit/verify` endpoint exposes this as an API. This is the level of audit integrity that financial systems require.

**Anomaly detection that catches real attack patterns.** Rapid privilege escalation, automated high-frequency abuse, cross-service scope hopping, and novel tool usage -- four distinct detection patterns, each with configurable thresholds and severity levels, running in real-time after every tool call.

**Domain-specific agent architecture.** The Email Triage Agent is not a generic chatbot with permissions bolted on. The system prompt, the two operating modes (Progressive and Strict Isolation with Reader/Writer), and the progressive authorization flow are all designed around a real email triage workflow where permission escalation follows natural task progression: read emails first, then draft replies, then create follow-up tasks. Cross-service suggestions after triage drive progressive scope expansion across Gmail, Calendar, and Tasks.

**Auth0 Actions as executable documentation.** The Post-Login and Token Exchange Actions are not just described -- they are implemented as exportable string constants with full logic: custom namespace claims, connected-account counting, high-risk scope detection, step-up verification with 5-minute windows, and structured audit logging. These are production-ready reference implementations.

**A security operations dashboard built with zero external chart dependencies.** Every visualization -- security score gauge, scope topology, token lifecycle, JWT inspector, scope analytics with donut and bar charts, consent timeline, delegation chain -- is pure CSS and React. Conic-gradient donuts, flexbox stacked bars, and grid-based topology. No D3, no Chart.js, no Recharts.

## What we learned

**credentialsContext is the most underrated security primitive in the SDK.** The difference between `'thread'` and `'tool-call'` determines whether credentials are cached across tool invocations or isolated per-call. Read operations should use `'thread'` for performance. Write operations must use `'tool-call'` for security. This single configuration option has more security impact than any other setting.

**Multi-agent isolation requires enforcement, not instructions.** Telling an LLM "you are the Reader Agent, do not write" is prompt engineering. Removing write tools from its execution context is enforcement. We built agent-level isolation by filtering tool maps, but this should be a first-class SDK feature.

**Risk classification of tool calls should be a framework feature.** We built a policy engine that maps every tool to GREEN/AMBER/RED. This is not application-specific -- it is a universal need. Every agent application needs to distinguish between reads, writes, and destructive operations.

**Tamper-proof audit trails are mandatory for enterprise adoption.** Standard logging is insufficient when agents operate on behalf of users. The hash-chained audit trail guarantees that no entry can be modified without detection. This is the accountability layer the agent ecosystem is missing.

**Scope expiry transforms the security model.** Time-bound grants (GREEN=30min, AMBER=10min, RED=5min) mean the agent's access naturally decays over time. Without active renewal, all permissions evaporate. This is fundamentally different from the current "grant once, persist forever" model.

**Anomaly detection is essential, not optional.** A rapid escalation from email reading to financial transactions within 60 seconds is a strong signal of automated attack. Without anomaly detection, the system cannot distinguish between normal user behavior and credential probing.

## What's next for Scope Lock

**Auth0 FGA for Document-Level Access Control.** Fine-grained authorization at the individual resource level -- specific Google Docs, specific GitHub repos, specific Slack channels -- not just the API level.

**MCP Server Authentication.** As Model Context Protocol becomes the standard for agent-tool communication, Scope Lock's progressive authorization pattern needs to work with MCP's authentication flow. Token Vault-backed MCP auth is the logical next step.

**Server-Side Scope TTL Enforcement.** Moving scope expiry from application-layer enforcement to Token Vault integration, so expired grants actually revoke cached credentials at the provider level.

**NPM Package for Progressive Authorization.** The multi-agent isolation + policy engine + branded consent + audit trail + anomaly detection pattern is reusable. We want to extract it into a standalone package that any Vercel AI SDK project can use.

## Built With

auth0, nextjs, vercel-ai-sdk, typescript, openai, gpt-4o, tailwindcss, token-vault, ciba, oauth2, react, sha-256, lucide-react

---

# DELIVERABLE 2: Bonus Blog Post

---

## Bonus Blog Post

### What Happens When You Treat AI Agent Authorization as a Real Security Problem

Most AI agent demos treat authorization as a checkbox: connect to Gmail, grant all scopes, move on. We wanted to find out what happens when you take it seriously -- when you build the audit trail, the anomaly detection, the rate limiting, the scope expiry, and the tamper-proof logging that a production system actually needs.

The answer: you end up building an entire security framework, and you discover that the primitives for it barely exist.

Scope Lock started as an email triage agent. The user asks the agent to check their inbox. The agent needs gmail.readonly. Auth0 Token Vault brokers that credential without the LLM ever seeing the raw token. Simple enough.

But then the user wants to draft a reply. That requires gmail.compose -- a write scope. And suddenly we are in different territory. A read operation that exposes data is categorically different from a write operation that creates data on the user's behalf. So we built a policy engine. Every tool call gets classified: GREEN for reads (auto-approve), AMBER for writes (warn and proceed), RED for financial operations (require step-up authentication via CIBA mobile push). This three-tier model maps directly to real user expectations about what an agent should do silently versus what requires explicit approval.

Then we needed isolation. We built two approaches. The default is Progressive Mode -- a single agent with access to all 8 tools that earns each scope inline through branded consent cards. But we also built Strict Isolation Mode with two sub-agents -- Reader and Writer -- each with a hard boundary around which tools they can access. Not prompt-level restrictions ("you are the Reader Agent, don't write") -- those are suggestions, not security. The Reader Agent's execution context does not contain `gmailDraftTool`. The function literally does not exist in its scope. We filter the tool map by agent ID before passing it to the Vercel AI SDK's `streamText`. This is enforcement at the SDK layer.

The insight that emerged: Progressive Mode is the better user experience. Users do not want to switch agents -- they want a single conversation where permissions accumulate naturally. Strict Isolation proves the security model is real (tools are physically excluded), but Progressive Mode is what you would actually ship.

The most underrated discovery was `credentialsContext`. This single configuration parameter on each `withTokenVault()` call controls whether credentials are cached across tool invocations (`'thread'`) or resolved fresh per call (`'tool-call'`). We use `'thread'` for all reads and `'tool-call'` for all writes. One line of config. Enormous security impact.

But enforcement without accountability is incomplete. So we built a SHA-256 hash-chained audit trail. Every tool call gets logged with its scopes, connection, risk level, and timestamp. Each entry's hash is computed from the previous entry's hash plus its own payload. Modify any entry, and every subsequent hash breaks. The `verifyAuditChain()` function walks the chain and pinpoints the exact index of any tampering.

On top of the audit trail, we added anomaly detection. Four patterns: rapid privilege escalation (GREEN to RED within 60 seconds), high-frequency calls (>10 per minute), cross-service scope hopping (3+ connections in 30 seconds), and novel tool usage. These run in real-time after every tool call.

We added scope TTL -- time-bound grants that expire automatically. GREEN scopes last 30 minutes. AMBER scopes last 10 minutes. RED scopes last 5 minutes. Without active renewal, all permissions decay to zero. This transforms the security model from "grant once, persist forever" to "access naturally expires."

We added per-agent rate limiting: Reader gets 50 calls per 5 minutes, Writer gets 15. We added cryptographic delegation chains that hash-sign every agent switch. We added Rich Authorization Requests per RFC 9396 for structured transaction details.

The result is 300 automated tests across 12 test files and 14 live security assertions, all passing. A security operations dashboard with a scope topology, JWT inspector, analytics with pure CSS charts, consent timeline, and anomaly alerts. A sandbox that runs security assertions against the live system. Demo data seeding so the dashboard is not empty on first visit. An onboarding overlay that walks first-time users through zero-trust start, progressive authorization, and scope presets.

The gap we found is clear: Token Vault handles credential brokering beautifully. What is missing is everything above it. The policy engine, the per-agent isolation, the audit trail, the anomaly detection, the scope expiry, the rate limiting -- these are not application-specific concerns. They are universal needs for any agent that touches real user data. Auth0 should ship them as platform features.

We built what the platform does not yet provide. And we proved it works with 300 tests.

---

# DELIVERABLE 3: 3-Minute Demo Video Script

---

## Demo Video Script (3:00)

### 0:00 - 0:15 | Hook

[Screen: Black screen, then fade into the Scope Lock login page]

"Every AI agent asks for all your permissions upfront. Scope Lock takes the opposite approach: zero permissions, progressive authorization, branded consent cards, SHA-256 audit chains, anomaly detection, automatic scope expiry, and 300 automated tests. This is the Email Triage Agent."

### 0:15 - 0:35 | Zero-Trust Start and Quick Actions

[Screen: Log in via Auth0. Onboarding overlay appears -- click through the four steps. Land on the chat page in Progressive Mode. The Active Scopes Bar reads "Zero Trust -- No services authorized."]

"Progressive Mode -- one unified agent, zero permissions. Quick action buttons: Triage Inbox, Today's Schedule, My Tasks, Draft Email. Each one triggers a different scope request."

[Screen: Show the Scope Preset Selector. Click through Lockdown (zero tools), Privacy (read-only), Productivity (all 8 tools)]

"Scope Presets add a control layer. Lockdown disables all tools. Privacy restricts to read-only. Productivity enables all 8 tools. I'll start in Productivity mode."

### 0:35 - 1:10 | Email Triage -- Progressive Authorization

[Screen: Click the "Triage Inbox" quick action button]

"The agent needs gmail.readonly. Watch the branded consent card."

[Screen: The branded authorization card appears showing Google icon, "Read Only" risk badge, "Gmail Read" scope, description "Read your email subjects, senders, and content." Expandable data access details. TTL display: "This permission will automatically expire after 30 minutes." Security footer explains Token Vault credential management. Dismiss button visible.]

"Custom consent card -- not a generic popup. Service name, risk level, exactly what data will be accessed, when it expires, and a note that the agent never sees raw tokens. I can dismiss or cancel anytime."

[Screen: Authorize. The Active Scopes Bar updates with a green Gmail indicator. The agent streams back a formatted triage report: URGENT / ACTION / INFO categories with suggested actions, followed by cross-service Next Steps]

"The scopes bar went from zero trust to Gmail read-only. The agent triages emails and then suggests follow-ups: check calendar for a mentioned meeting, create a task for an action item, draft a reply to the urgent email. Each one requires a NEW scope grant."

### 1:10 - 1:40 | Scope Escalation -- Cross-Service Progressive Expansion

[Screen: Click the suggested "Draft reply" action. New consent card appears with "Write Access" amber badge and TTL "expires after 10 minutes". Authorize. Active Scopes Bar updates -- Gmail indicator changes from green to amber]

"Amber badge -- write access. Different scope, different consent, different TTL. No agent switching -- the same conversation, progressively earning permissions."

[Screen: Agent drafts the reply. Then ask "Create a follow-up task for the PR review email." New consent card for Tasks scope appears. Authorize.]

"And now a third scope -- Tasks. Three different Google services authorized progressively in one conversation. Each logged in the SHA-256 audit trail."

### 1:40 - 1:55 | Strict Isolation Mode

[Screen: Toggle to Strict Isolation Mode. Show Reader and Writer agent cards. Select Reader -- show it has only 4 read tools. Select Writer -- show it has only 4 write tools]

"Strict Isolation Mode -- hard credential boundaries. The Reader Agent physically cannot call write tools. The Writer Agent physically cannot call read tools. Tools are excluded from the LLM context at the SDK layer. This is enforcement, not prompt engineering."

### 1:55 - 2:35 | Security Operations Dashboard

[Screen: Navigate to the Dashboard. Security Score gauge animates. Scroll through panels]

"Full security operations dashboard. Security score out of 100."

[Screen: Show Scope Topology visualization -- agents connected to tools connected to services with colored lines]

"Scope topology showing every agent-to-tool-to-service boundary."

[Screen: Show JWT Token Inspector with decoded claims and expiry countdown. Show Scope Analytics with donut chart and stacked bar charts]

"JWT inspector with live expiry countdown. Scope analytics with read/write ratio and usage over time -- all pure CSS, no charting libraries."

[Screen: Show Consent History Timeline with alternating event cards. Show Delegation Chain with SHA-256 hashes between agent nodes]

"Consent timeline tracking every authorization decision. Delegation chain with cryptographic hashes signing every agent switch."

[Screen: Show Scope Expiry panel with countdown timers -- GREEN 28m remaining, AMBER 8m, RED 3m]

"Scope TTL -- every grant auto-expires. GREEN scopes last 30 minutes, AMBER 10, RED 5. Access naturally decays to zero."

### 2:35 - 2:50 | Security Sandbox

[Screen: Navigate to Security page, Tests tab. Show 14 assertions running and all passing with green checkmarks. Categories: Isolation, Policy, Credential, Audit]

"14 security assertions running against the live system. Agent isolation boundaries, policy classification, credential scoping, audit chain integrity -- all verified. 300 total tests across 12 test files."

### 2:50 - 3:00 | Closing

[Screen: Split view -- chat with triage report and follow-up suggestions on left, dashboard with topology and analytics on right]

"Scope Lock. An Email Triage Agent with progressive authorization as the hero experience. Zero-trust start, branded consent cards, cross-service scope expansion, quick action buttons, and strict multi-agent isolation as the advanced toggle. SHA-256 audit chains. Anomaly detection. Automatic scope expiry. 300 automated tests. Built with Auth0 Token Vault and GPT-4o. Because AI agents should earn access, not assume it."

[Screen: Fade to Scope Lock logo with "Built with Auth0 Token Vault" and the GitHub URL]
