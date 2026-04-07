# Scope Lock

**Zero-trust progressive authorization for AI agents, built on Auth0 Token Vault.**

Your AI agent wants access to Gmail, Calendar, and Tasks. Today, you grant everything or nothing. Scope Lock introduces a third option: the agent starts with **zero permissions** and earns each one individually -- explaining what it needs, why it needs it, and logging every action in a tamper-evident audit trail.

**The hero experience is Progressive Mode** -- a single unified agent that starts with zero scopes and earns each one inline as the conversation naturally requires them. No agent switching, no upfront permissions. Scope Lock also ships Strict Isolation Mode as an advanced toggle, demonstrating hard multi-agent credential boundaries enforced at the SDK layer.

**Live Demo:** [scope-lock-pi.vercel.app](https://scope-lock-pi.vercel.app)

---

## How It Works

One conversation. Four scope escalations. Three Google services. Zero upfront permissions.

```
"Triage my inbox"     → gmail.readonly requested (GREEN) → approved → emails categorized
"Draft a reply"       → gmail.compose requested (AMBER)  → approved → draft created
"Am I free at 3pm?"   → calendar.events requested (GREEN) → approved → availability checked
"Create a follow-up"  → tasks requested (GREEN)           → approved → task created
```

Each scope request shows a branded consent card with the service name, risk level, what data will be accessed, and when the permission expires. The Active Scopes Bar fills progressively. The audit trail records every decision with SHA-256 hash chains.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js 15 Frontend                        │
│                                                                     │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │   Chat   │  │ Dashboard │  │   Security    │  │   Profile    │  │
│  │  Window  │  │ (Scores,  │  │ (Matrix,      │  │  (Accounts,  │  │
│  │  + Quick │  │  Audit,   │  │  Sandbox,     │  │   Sessions)  │  │
│  │ Actions  │  │  Scopes)  │  │  Insights)    │  │              │  │
│  └────┬─────┘  └───────────┘  └───────────────┘  └──────────────┘  │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │              Scope Presets (Privacy Modes)                   │    │
│  │  Lockdown (0 tools) | Privacy (read-only) | Productivity   │    │
│  └────┬────────────────────────────────────────────────────────┘    │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │            Agent Orchestrator                                │    │
│  │                                                               │    │
│  │  Progressive Mode (default):                                  │    │
│  │    Single unified agent, all 8 tools, earns scopes inline     │    │
│  │                                                               │    │
│  │  Strict Isolation Mode (toggle):                              │    │
│  │  ┌──────────┐  ┌──────────┐                                 │    │
│  │  │  Reader  │  │  Writer  │                                 │    │
│  │  │  Agent   │  │  Agent   │                                 │    │
│  │  │ (GREEN)  │  │ (AMBER)  │                                 │    │
│  │  │ 4 tools  │  │ 4 tools  │                                 │    │
│  │  └────┬─────┘  └────┬─────┘                                 │    │
│  │       │              │                                       │    │
│  │  SHA-256 Delegation Chains (agent-to-agent escalation)      │    │
│  └────┬─────────────────┬──────────────────────────────────────┘    │
│       │                 │                                           │
│  ┌────▼─────────────────▼──────────────────────────────────────┐    │
│  │              Risk-Tier Policy Engine                          │    │
│  │  GREEN: auto-approve | AMBER: warn-and-proceed              │    │
│  └────┬────────────────────────────────────────────────────────┘    │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │         Vercel AI SDK (streamText + withInterruptions)       │    │
│  │         OpenAI GPT-4o + Tool Calling                         │    │
│  └────┬────────────────────────────────────────────────────────┘    │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │              Auth0 AI SDK (@auth0/ai-vercel)                 │    │
│  │                                                               │    │
│  │  withTokenVault()           credentialsContext:               │    │
│  │  ├─ Gmail Read  (thread)    ├─ 'thread'    (reads)           │    │
│  │  ├─ Gmail Write (tool-call) └─ 'tool-call' (writes)         │    │
│  │  ├─ Calendar    (thread)                                      │    │
│  │  └─ Tasks       (thread / tool-call per operation)            │    │
│  └────┬────────────────────────────────────────────────────────┘    │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │              Security Subsystems                              │    │
│  │                                                               │    │
│  │  Audit Trail ─── SHA-256 hash-chained, tamper-evident        │    │
│  │  Anomaly Detection ─── 4 detection patterns                   │    │
│  │  Scope TTL ─── auto-expiry (30m/10m/5m by risk)              │    │
│  │  Rate Limiter ─── per-agent limits (50/15 per 5min)           │    │
│  │  Scope Resolver ─── dependency analysis + auth plans          │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Auth0 Token Vault                              │
│                                                                     │
│  Stores & manages OAuth tokens for:                                 │
│  └─ Google (Gmail, Calendar, Tasks)                                 │
│                                                                     │
│  RFC 8693 token exchange -- agent never sees raw credentials.       │
│  Tokens are scoped, rotated, and revocable.                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Two Operating Modes

Scope Lock offers two modes, toggled from the chat interface:

| Mode | Default | How It Works |
|------|---------|-------------|
| **Progressive Mode** | Yes | A single unified agent with access to ALL 8 tools. Scopes are earned progressively through Token Vault interrupts as the conversation naturally requires them. The agent never tells the user to "switch agents" -- it requests each scope escalation inline. After triaging emails, it suggests cross-service follow-ups (check calendar, create task, draft reply) that each require a new scope grant. |
| **Strict Isolation Mode** | No (toggle) | Two separate agents (Reader + Writer) with hard credential boundaries. Each agent can ONLY access its authorized tools. Demonstrates real tool-level enforcement, not prompt engineering. |

**Progressive Mode is the hero experience.** Judges see zero-trust start, progressive scope expansion, branded consent cards with data access details and TTL display, quick action buttons, cross-service follow-up suggestions, and the full email triage workflow -- all in a single conversation. Strict Isolation Mode is the advanced toggle that demonstrates multi-agent credential isolation architecture.

---

## Features

### 1. Progressive Authorization (Default Experience)

The hero feature. A single unified agent starts with **zero permissions** and earns each scope inline as the conversation progresses. The agent explains what it needs, why, and presents a **branded consent card** with the service name, risk level (Read Only / Write Access / Elevated), a human-readable description of exactly what data will be accessed, an expandable "What data will be accessed?" section, and a TTL display showing when the permission will auto-expire.

Quick action buttons in the welcome message let users start immediately: "Triage Inbox", "Today's Schedule", "My Tasks", or "Draft Email". After triage, the agent suggests cross-service follow-ups (check calendar, create task, draft reply) -- each requiring a new scope grant, demonstrating progressive expansion across Google services.

The consent popup handles timeout (60-second auto-expiry with countdown), cancel/dismiss, and popup-blocked states gracefully.

### 2. Multi-Agent Scope Isolation (Strict Isolation Mode)

Two specialized agents with **hard credential boundaries** -- not prompt-level restrictions, but actual tool-level enforcement. Each agent is constructed with only its authorized tools passed to the LLM. The Reader Agent physically cannot invoke `gmailDraftTool` because the tool does not exist in its execution context.

| Agent | Risk | Tools | Credentials | Can Delegate To |
|-------|------|-------|-------------|-----------------|
| **Reader** | LOW | `gmailSearchTool`, `getCalendarEventsTool`, `getTasksTool`, `getUserInfoTool` | `thread` (shared per-session) | Writer |
| **Writer** | MEDIUM | `gmailDraftTool`, `createTasksTool`, `deleteTaskTool`, `completeTaskTool` | `tool-call` (isolated per-invocation) | None |

8 tools total: 4 reader (GREEN risk) + 4 writer (AMBER risk).

**Isolation mechanism:** `Object.entries(allTools).filter(([name]) => allowedToolNames.includes(name))` -- tools are physically excluded from the `streamText()` call.

### 3. Risk-Tier Policy Engine

Every tool call is classified before execution. The policy engine maps each tool to a risk level, required action, and authentication method.

| Risk Level | Action | Auth Required | Tools |
|-----------|--------|---------------|-------|
| **GREEN** | Auto-approve | None | Gmail Search, Calendar, Tasks, User Info |
| **AMBER** | Warn and proceed | Consent | Gmail Draft, Create Task, Delete Task, Complete Task |

Unknown tools default to AMBER -- the engine is fail-safe, never fail-open.

### 4. Scope Presets (Privacy Modes)

Users control the agent's maximum capability through three presets that gate which tools are available to the LLM:

| Preset | Tools Available | Risk Threshold | Effect |
|--------|----------------|----------------|--------|
| **Lockdown** | 0 | GREEN | Agent cannot access any external service |
| **Privacy** | 4 (read-only) | GREEN | Agent can read but never modify data |
| **Productivity** | 8 (all) | RED | Full access; writes use isolated credentials |

Presets are enforced as an intersection with agent tools -- the LLM receives only tools that appear in **both** the agent's tool list **and** the preset's allowed list.

### 5. SHA-256 Hash-Chained Audit Trail

Every tool call produces an immutable audit entry chained via SHA-256 hashes. Each entry records:

- Tool name and connection used
- OAuth scopes consumed
- Risk level classification from the policy engine
- Credential context level (`thread` or `tool-call`)
- Success/failure status and duration
- Cryptographic hash linking to previous entry
- User ID and timestamp

The chain is verifiable: `verifyAuditChain()` walks every entry, recomputes hashes, and confirms no tampering occurred. The genesis hash is `0x00...00` (64 zeros).

### 6. Anomaly Detection Engine

Analyzes the audit trail after each tool call to detect four categories of suspicious behavior:

| Pattern | Severity | Trigger |
|---------|----------|---------|
| **RAPID_ESCALATION** | High | GREEN to RED within 60 seconds |
| **HIGH_FREQUENCY** | Medium | 10+ tool calls in 60 seconds |
| **SCOPE_HOPPING** | Medium | 3+ distinct connections in 30 seconds |
| **UNUSUAL_SCOPE** | Low/High | First-time tool use after baseline established (5+ prior calls) |

Alerts are persisted per-user (capped at 100) and surfaced in the dashboard.

### 7. Scope TTL and Auto-Revocation

Scope grants expire automatically based on risk level:

| Risk Level | TTL | Rationale |
|-----------|-----|-----------|
| GREEN | 30 minutes | Read scopes are low risk |
| AMBER | 10 minutes | Write scopes need shorter windows |
| RED | 5 minutes | High-risk scopes expire quickly |

The API supports manual revocation (`DELETE /api/scope-grants`), renewal (`POST /api/scope-grants`), and batch cleanup of all expired grants.

### 8. Per-Agent Rate Limiting

Rate limits are tuned by agent risk level -- higher-risk agents get stricter limits:

| Agent | Max Calls | Window | Rationale |
|-------|-----------|--------|-----------|
| Reader | 50 | 5 minutes | Reads are safe |
| Writer | 15 | 5 minutes | Writes mutate state |
| Default | 30 | 5 minutes | No agent selected |

### 9. Scope Dependency Resolver

Before executing a set of tools, the resolver computes the full authorization plan:

- Every scope required across all tools
- Connection count and deduplication
- Maximum risk level across the plan
- Whether step-up authentication is needed
- Human-readable markdown output the LLM can present to the user

```typescript
const plan = resolveScopes(['gmailSearchTool', 'gmailDraftTool', 'deleteTaskTool']);
// => { totalScopes: 3, maxRiskLevel: 'AMBER', requiresStepUp: false, estimatedConnections: 1 }
```

### 10. Agent Orchestrator with Delegation Chains

When users switch between agents (Reader -> Writer), each transition is recorded as a `DelegationRequest` with:

- SHA-256 hash of the delegation payload
- Source and target agent IDs
- Tools being requested
- Risk escalation metadata (e.g., `low -> medium`)
- Approval status

The delegation chain is append-only and tamper-evident -- creating a verifiable trail of every privilege escalation in the session.

### 11. Auth0 Actions (Post-Login + Token Exchange)

Two reference Auth0 Actions demonstrate production integration patterns:

**Post-Login Action** -- Enriches ID tokens with custom claims under the `https://scopelock.dev` namespace: connected account count, agent access list, scope grant count, and last login timestamp.

**Token Exchange Action** -- Intercepts Token Vault credential exchanges, logs every scope request for audit, and blocks high-risk scopes (compose, send, buy) unless step-up authentication was completed within a 5-minute window.

### 12. RFC 9396 Rich Authorization Requests

Standard CIBA sends a flat binding message. Scope Lock implements structured `RichAuthorizationDetail` objects per RFC 9396, including:

- Authorization type (`payment_initiation`, `account_information`)
- Actions (`initiate`, `confirm`)
- Monetary amounts with currency
- Creditor name and account

This enables PSD2 compliance, Open Banking interop, and machine-readable audit trails for financial operations.

### 13. Step-Up Authentication (CIBA)

RED-tier operations trigger Client-Initiated Backchannel Authentication through Auth0 Guardian. The agent blocks until the user explicitly approves or denies from their mobile device. The binding message contains transaction details ("Do you want to buy 2 AirPods?"). No silent financial transactions.

### 14. Credential Lifecycle Management

`credentialsContext` is the core security primitive controlling how long credentials persist:

| Context | Scope | Used For |
|---------|-------|----------|
| `thread` | Shared within conversation | Gmail Read, Calendar, Tasks Read, Create Task (performance) |
| `tool-call` | Isolated per invocation | Gmail Write, Delete Task, Complete Task (security) |

Read operations use `thread` for performance. Write operations use `tool-call` for isolation. This is a deliberate security architecture, not a default.

### 15. Demo Data Seeding

First-time dashboard visitors see meaningful data immediately. The `/api/seed-demo` endpoint seeds 10 audit entries spanning ~55 minutes (Gmail reads, Calendar views, Task reads, a draft creation, and a task creation), 4 scope request timeline entries, and a Reader-to-Writer delegation chain. All seeded entries are tagged with a `[demo]` prefix so they are distinguishable from real activity.

### 16. Onboarding Overlay

A four-step guided walkthrough for first-time users explaining zero-trust start, progressive authorization, scope presets, and the security dashboard. Persisted via localStorage so it only shows once.

### 17. Automated Security Test Suite

`GET /api/security-test` runs 14 security assertions across 4 categories:

**Isolation (5 assertions)**
- Reader Agent cannot access write tools
- Writer Agent cannot access read tools
- Reader Agent cannot access create tools
- Lockdown preset has zero tools
- Privacy preset has only read tools

**Policy (4 assertions)**
- Read tools classified GREEN
- Write tools classified AMBER
- Task creation tools classified AMBER
- Unknown tools default to AMBER

**Credential (2 assertions)**
- Gmail Read uses thread-scoped credentials
- Gmail Write uses per-call isolation

**Audit (2 assertions)**
- Audit store is functional (write + read verification)
- Audit entries include risk level field

---

## Complete API Surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Streaming chat with tool calling. Progressive Mode when no `agentId` param; Strict Isolation with `?agentId=reader\|writer`. Preset via `?preset=lockdown\|privacy\|productivity` |
| `GET` | `/api/audit` | Fetch audit trail entries and anomaly alerts for the authenticated user |
| `GET` | `/api/audit/verify` | Verify the SHA-256 hash chain integrity of the audit trail |
| `GET` | `/api/agents` | Introspect all agent profiles with tools, policy rules, rate limits, and preset compatibility |
| `GET` | `/api/delegation` | Fetch the delegation chain and active agent session |
| `GET` | `/api/rate-limit` | Check rate limit status for a specific agent (`?agentId=reader`) |
| `GET` | `/api/scope-grants` | List all scope grants with TTL countdown |
| `POST` | `/api/scope-grants` | Renew an existing scope grant |
| `DELETE` | `/api/scope-grants` | Revoke a specific connection's scope grant |
| `POST` | `/api/scope-plan` | Resolve the authorization plan for a set of tool names |
| `GET` | `/api/security-test` | Run 14 automated security assertions |
| `POST` | `/api/seed-demo` | Seed demo data for first-time dashboard visitors |
| `GET` | `/api/token-info` | Inspect JWT claims and token presence (never exposes raw tokens) |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (unauthenticated) with feature cards, progressive auth flow diagram; chat interface (authenticated) with agent selector, quick action buttons, and onboarding overlay |
| `/chat` | Redirects to `/` (chat is the home page for authenticated users) |
| `/dashboard` | Security score, connected services, audit trail, scope request timeline, policy rules, demo data seeding |
| `/security` | Tabbed view: Authorization Matrix, Security Sandbox (14 assertions), Architecture Insights |
| `/matrix` | Redirects to `/security?tab=matrix` |
| `/sandbox` | Redirects to `/security?tab=tests` |
| `/insights` | Redirects to `/security?tab=insights` |
| `/profile` | Connected accounts and session management |

---

## Test Coverage

300 passing tests across 12 test files:

| Test File | Tests | What It Covers |
|-----------|-------|---------------|
| `chat-route-integration.test.ts` | 49 | Progressive vs strict mode tool filtering, preset enforcement, agent switching, rate limiting, system prompt generation |
| `agent-preset-matrix.test.ts` | 44 | Full 2-agent x 3-preset matrix (6 combinations), tool set intersection, cannotAccess enforcement |
| `policy-engine.test.ts` | 38 | GREEN/AMBER/RED classification, unknown tool defaults, all 8 active rules have required fields |
| `agents.test.ts` | 31 | Agent tool access, isolation boundaries, `cannotAccess` declarations, deleteTaskTool/completeTaskTool in Writer |
| `gmail-parser.test.ts` | 23 | JSON/raw/HTML parsing, missing headers, malformed input, snippet truncation, LangChain format |
| `audit.test.ts` | 21 | Hash chaining, genesis hash, user isolation, chronological order, 200-entry cap, chain verification |
| `scope-ttl.test.ts` | 19 | TTL by risk level, grant/renew/revoke lifecycle, expiry checks, batch cleanup |
| `scope-resolver.test.ts` | 19 | Scope aggregation, deduplication, max risk computation, step-up detection, plan formatting |
| `scope-presets.test.ts` | 19 | Lockdown/Privacy/Productivity presets, risk thresholds, tool filtering, 8 tools in Productivity |
| `anomaly-detection.test.ts` | 16 | Rapid escalation, high frequency, scope hopping, unusual scope, alert accumulation and clearing |
| `rate-limiter.test.ts` | 14 | Per-agent rate limits (Reader 50, Writer 15, default 30), sliding window, cooldown |
| `scope-presets-integration.test.ts` | 7 | Agent x Preset intersection (Reader+Lockdown=0 tools, Writer+Privacy=0 tools, etc.) |

Run tests:
```bash
cd ts-vercel-ai
npx vitest run
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | App Router, Server Components, API routes |
| **Vercel AI SDK** | `streamText`, `createUIMessageStream`, `withInterruptions`, tool calling |
| **OpenAI GPT-4o** | LLM for agent reasoning and tool selection |
| **Auth0 Token Vault** | OAuth credential brokering via RFC 8693 token exchange |
| **Auth0 AI SDK** | `withTokenVault()`, `withAsyncAuthorization()`, interrupt handling |
| **Auth0 CIBA** | Step-up authentication for RED-tier operations via Guardian push |
| **@auth0/nextjs-auth0** | User authentication and session management |
| **Tailwind CSS** | UI styling |
| **Vitest** | Unit and integration testing |
| **Vercel** | Production deployment |
| **TypeScript** | End-to-end type safety |

---

## Setup

### Prerequisites

- Node.js 18+
- Auth0 tenant with Token Vault enabled
- OpenAI API key
- Google OAuth app (Gmail, Calendar, Tasks scopes)

### Environment Variables

Copy `.env.example` to `.env.local`:

```
AUTH0_SECRET=          # openssl rand -hex 32
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=          # your-tenant.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
OPENAI_API_KEY=
```

### Auth0 Configuration

1. Create a Regular Web Application in Auth0
2. Enable Connected Accounts endpoint
3. Configure Google OAuth2 connection with scopes: `email`, `profile`, `gmail.readonly`, `gmail.compose`, `calendar.events`, `tasks`
4. Enable Multi-Resource Refresh Tokens (MRRT)
5. Set Allowed Callback URLs: `http://localhost:3000/auth/callback`
6. Configure Auth0 Guardian for CIBA push notifications

### Install and Run

```bash
cd ts-vercel-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run Security Tests

```bash
# Unit + integration tests
npx vitest run

# Automated security assertions (requires running server)
curl http://localhost:3000/api/security-test | jq
```

---

## Judging Criteria Mapping

### 1. Security Model

| Feature | Implementation |
|---------|---------------|
| Progressive authorization (default) | Agent starts with zero permissions; each scope requested individually with branded consent card showing data access, risk level, and TTL |
| Multi-agent credential isolation | 2 agents with hard tool boundaries -- tools physically excluded from LLM context (8 tools: 4 reader + 4 writer) |
| Risk-tier policy engine | GREEN/AMBER/RED classification with auto-approve, warn, and step-up actions |
| Credential lifecycle (`credentialsContext`) | `thread` for reads (performance), `tool-call` for writes (isolation) |
| Token Vault | RFC 8693 token exchange -- agent never sees raw OAuth tokens |
| CIBA step-up authentication | RED-tier actions require mobile push approval via Auth0 Guardian |
| Scope TTL + auto-revocation | Time-based expiry (30m/10m/5m) enforced per risk level |
| Anomaly detection | 4 detection patterns: rapid escalation, high frequency, scope hopping, unusual scope |
| Rate limiting | Per-agent limits tuned by risk level (50/15 calls per 5 minutes) |
| 14 automated security assertions | Isolation, policy, credential, and audit assertions verified on every request |

### 2. User Control

| Feature | Implementation |
|---------|---------------|
| Scope Presets | Lockdown (zero tools), Privacy (read-only), Productivity (full access with 8 tools) |
| Permission Dashboard | Security score, connected services, scope badges, revoke buttons, demo data seeding |
| Active Scopes Bar | Real-time zero-trust display showing current authorization state with read/write level indicators |
| Branded authorization cards | Custom consent UI with service name, risk level, data access description, expandable detail section, and TTL display |
| Quick action buttons | Contextual suggestions per agent/mode: Triage Inbox, Today's Schedule, My Tasks, Draft Email |
| Follow-up suggestions | After triage, agent suggests cross-service actions (calendar, tasks, draft) each requiring new scopes |
| Popup timeout/cancel | 60-second countdown with auto-expiry, cancel/dismiss buttons, popup-blocked detection with retry |
| Onboarding overlay | Four-step guided walkthrough for first-time users (persisted via localStorage) |
| Manual scope revocation | `DELETE /api/scope-grants` to revoke any connection instantly |
| Agent selection | User chooses Progressive Mode or Strict Isolation (Reader/Writer) |
| Audit trail visibility | Every tool call visible with scopes, risk level, and outcome |

### 3. Technical Execution

| Feature | Implementation |
|---------|---------------|
| Auth0 AI SDK integration | `withTokenVault()` for 4 Google service connections (Gmail read, Gmail write, Calendar, Tasks), `withAsyncAuthorization()` for CIBA |
| Vercel AI SDK streaming | `streamText` + `createUIMessageStream` + `withInterruptions` for interrupt-driven consent |
| RFC 8693 token exchange | Token Vault credential brokering without exposing raw tokens |
| RFC 9396 Rich Authorization Requests | Structured authorization details for financial operations |
| SHA-256 hash chains | Tamper-evident audit trail and delegation chains |
| Scope dependency resolver | Computes minimal authorization plans with risk aggregation |
| 300 passing tests | 12 test files covering policy, isolation, audit, anomaly detection, presets, resolver, rate limiter, TTL, agent-preset matrix, chat route integration |
| 13 API endpoints | Full REST API for all security subsystems including demo data seeding |
| Auth0 Actions | Post-Login token enrichment + Token Exchange scope gating |

### 4. Design

| Feature | Implementation |
|---------|---------------|
| Dark-mode UI | Consistent design across all pages with error boundaries and recovery buttons |
| Security score gauge | Computed 0-100 score based on active scopes and risk profile |
| Color-coded scope badges | Green (read), amber (write), red (admin) |
| Agent selector cards | Progressive Mode (default) and Strict Isolation toggle with visual risk indicators |
| Quick action buttons | Contextual cards per mode: Triage Inbox, Today's Schedule, My Tasks, Draft Email |
| Scope Presets selector | Three-mode toggle with color-coded states |
| Active Scopes Bar | Progressive zero-trust to authorized visualization with per-service read/write indicators |
| Branded consent cards | Custom authorization UI with data access details, TTL display, and expandable data breakdown |
| Popup timeout/cancel | 60-second countdown, auto-expiry, dismiss/retry, popup-blocked handling |
| Onboarding overlay | Four-step guided walkthrough for first-time users |
| Demo data seeding | Realistic audit entries, scope requests, and delegation chains on first dashboard visit |
| Security tabs | Matrix, Sandbox, and Insights in a unified security view |
| Error boundaries | Every page wrapped with recovery buttons (`Dashboard`, `Security`, `Profile`, `Chat`) |

### 5. Potential Impact

| Feature | Impact |
|---------|--------|
| Progressive authorization pattern | Reusable for any AI agent connecting to OAuth-protected services |
| Multi-agent isolation model | Template for per-agent credential boundaries in any agent framework |
| Risk-tier policy engine | Universal pattern for classifying tool calls by risk level |
| `credentialsContext` best practice | Documented security/performance tradeoff applicable to all Token Vault users |
| Anomaly detection for agents | Novel pattern for detecting automated abuse in agent authorization |
| Scope TTL | Demonstrates time-bound authorization that Auth0 could ship as a platform feature |

### 6. Insight Value

| Feature | Insight |
|---------|---------|
| `credentialsContext` documentation | Most underrated security primitive in the SDK -- single-line config with massive behavioral impact |
| Scope expiry gap | Token Vault has no built-in TTL -- grants persist until manual revocation |
| Per-agent isolation gap | Auth0 AI SDK operates at tool level, not agent level -- isolation requires application-layer enforcement |
| Policy engine gap | No industry standard for risk-classifying tool calls -- every developer reinvents this |
| Audit schema gap | No standard `AuditEvent` schema for agent authorization logging |
| Auth0 Actions showcase | Concrete reference implementations for Post-Login and Token Exchange actions |
| Concrete recommendations | Scope expiry, agent boundaries, policy engine, audit schema, consent hooks, dashboard widgets |

---

## License

MIT
