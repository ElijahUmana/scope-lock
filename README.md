# Scope Lock

**Zero-trust progressive authorization for AI agents, built on Auth0 Token Vault.**

Your AI agent wants access to Gmail, Calendar, and Tasks. Today, you grant everything or nothing. Scope Lock introduces a third option: the agent starts with **zero permissions** and earns each one individually -- explaining what it needs, why it needs it, and logging every action in a tamper-evident audit trail.

**Live Demo:** [scope-lock-pi.vercel.app](https://scope-lock-pi.vercel.app)

---

## The Use Case: Email Triage Agent

A busy professional asks their AI assistant to triage their inbox. Here is what happens:

```
User: "Show me my recent emails"

Agent: "I'll need read-only access to your Gmail (gmail.readonly scope).
        This is brokered through Auth0 Token Vault -- I never see your credentials."
        [Branded authorization card: Google | Read Only | GREEN risk]
        [User approves]

Agent: "Here are your 10 most recent emails, categorized by priority:

        URGENT -- Meeting moved to 3pm (from: boss@company.com)
          Suggested action: Reply to confirm

        ACTION -- PR review requested (from: dev@team.com)
          Suggested action: Create follow-up task

        INFO -- Newsletter digest (from: news@service.com)
          Suggested action: Archive"

User: "Draft a reply to the first one saying I'll be there"

Agent: "This requires WRITE access to Gmail (gmail.compose scope).
        This is a higher-privilege operation -- AMBER risk level.
        Credentials will be isolated per-invocation for security."
        [Branded authorization card: Google | Write Access | AMBER risk]
        [User approves]

Agent: "Draft created: 'Thanks, I'll be there at 3pm.'"
```

Every step is visible. Every scope is earned. Every action is logged.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js 15 Frontend                        │
│                                                                     │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │   Chat   │  │ Dashboard │  │   Security    │  │   Profile    │  │
│  │  Window  │  │ (Scores,  │  │ (Matrix,      │  │  (Accounts,  │  │
│  │  + Agent │  │  Audit,   │  │  Sandbox,     │  │   Sessions)  │  │
│  │ Selector │  │  Scopes)  │  │  Insights)    │  │              │  │
│  └────┬─────┘  └───────────┘  └───────────────┘  └──────────────┘  │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │              Scope Presets (Privacy Modes)                   │    │
│  │  Lockdown (0 tools) | Privacy (read-only) | Productivity   │    │
│  └────┬────────────────────────────────────────────────────────┘    │
│       │                                                             │
│  ┌────▼────────────────────────────────────────────────────────┐    │
│  │            Multi-Agent Orchestrator                          │    │
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

## Features

### 1. Multi-Agent Scope Isolation

Two specialized agents with **hard credential boundaries** -- not prompt-level restrictions, but actual tool-level enforcement. Each agent is constructed with only its authorized tools passed to the LLM. The Reader Agent physically cannot invoke `gmailDraftTool` because the tool does not exist in its execution context.

| Agent | Risk | Tools | Credentials | Can Delegate To |
|-------|------|-------|-------------|-----------------|
| **Reader** | LOW | `gmailSearchTool`, `getCalendarEventsTool`, `getTasksTool`, `getUserInfoTool` | `thread` (shared per-session) | Writer |
| **Writer** | MEDIUM | `gmailDraftTool`, `createTasksTool`, `deleteTaskTool`, `completeTaskTool` | `tool-call` (isolated per-invocation) | None |

**Isolation mechanism:** `Object.entries(allTools).filter(([name]) => allowedToolNames.includes(name))` -- tools are physically excluded from the `streamText()` call.

### 2. Risk-Tier Policy Engine

Every tool call is classified before execution. The policy engine maps each tool to a risk level, required action, and authentication method.

| Risk Level | Action | Auth Required | Tools |
|-----------|--------|---------------|-------|
| **GREEN** | Auto-approve | None | Gmail Search, Calendar, Tasks, User Info |
| **AMBER** | Warn and proceed | Consent | Gmail Draft, Create Task, Delete Task, Complete Task |

Unknown tools default to AMBER -- the engine is fail-safe, never fail-open.

### 3. Scope Presets (Privacy Modes)

Users control the agent's maximum capability through three presets that gate which tools are available to the LLM:

| Preset | Tools Available | Risk Threshold | Effect |
|--------|----------------|----------------|--------|
| **Lockdown** | 0 | GREEN | Agent cannot access any external service |
| **Privacy** | 4 (read-only) | GREEN | Agent can read but never modify data |
| **Productivity** | 8 (all) | RED | Full access; writes use isolated credentials |

Presets are enforced as an intersection with agent tools -- the LLM receives only tools that appear in **both** the agent's tool list **and** the preset's allowed list.

### 4. SHA-256 Hash-Chained Audit Trail

Every tool call produces an immutable audit entry chained via SHA-256 hashes. Each entry records:

- Tool name and connection used
- OAuth scopes consumed
- Risk level classification from the policy engine
- Credential context level (`thread` or `tool-call`)
- Success/failure status and duration
- Cryptographic hash linking to previous entry
- User ID and timestamp

The chain is verifiable: `verifyAuditChain()` walks every entry, recomputes hashes, and confirms no tampering occurred. The genesis hash is `0x00...00` (64 zeros).

### 5. Anomaly Detection Engine

Analyzes the audit trail after each tool call to detect four categories of suspicious behavior:

| Pattern | Severity | Trigger |
|---------|----------|---------|
| **RAPID_ESCALATION** | High | GREEN to RED within 60 seconds |
| **HIGH_FREQUENCY** | Medium | 10+ tool calls in 60 seconds |
| **SCOPE_HOPPING** | Medium | 3+ distinct connections in 30 seconds |
| **UNUSUAL_SCOPE** | Low/High | First-time tool use after baseline established (5+ prior calls) |

Alerts are persisted per-user (capped at 100) and surfaced in the dashboard.

### 6. Scope TTL and Auto-Revocation

Scope grants expire automatically based on risk level:

| Risk Level | TTL | Rationale |
|-----------|-----|-----------|
| GREEN | 30 minutes | Read scopes are low risk |
| AMBER | 10 minutes | Write scopes need shorter windows |
| RED | 5 minutes | High-risk scopes expire quickly |

The API supports manual revocation (`DELETE /api/scope-grants`), renewal (`POST /api/scope-grants`), and batch cleanup of all expired grants.

### 7. Per-Agent Rate Limiting

Rate limits are tuned by agent risk level -- higher-risk agents get stricter limits:

| Agent | Max Calls | Window | Rationale |
|-------|-----------|--------|-----------|
| Reader | 50 | 5 minutes | Reads are safe |
| Writer | 15 | 5 minutes | Writes mutate state |
| Default | 30 | 5 minutes | No agent selected |

### 8. Scope Dependency Resolver

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

### 9. Agent Orchestrator with Delegation Chains

When users switch between agents (Reader -> Writer), each transition is recorded as a `DelegationRequest` with:

- SHA-256 hash of the delegation payload
- Source and target agent IDs
- Tools being requested
- Risk escalation metadata (e.g., `low -> medium`)
- Approval status

The delegation chain is append-only and tamper-evident -- creating a verifiable trail of every privilege escalation in the session.

### 10. Auth0 Actions (Post-Login + Token Exchange)

Two reference Auth0 Actions demonstrate production integration patterns:

**Post-Login Action** -- Enriches ID tokens with custom claims under the `https://scopelock.dev` namespace: connected account count, agent access list, scope grant count, and last login timestamp.

**Token Exchange Action** -- Intercepts Token Vault credential exchanges, logs every scope request for audit, and blocks high-risk scopes (compose, send, buy) unless step-up authentication was completed within a 5-minute window.

### 11. RFC 9396 Rich Authorization Requests

Standard CIBA sends a flat binding message. Scope Lock implements structured `RichAuthorizationDetail` objects per RFC 9396, including:

- Authorization type (`payment_initiation`, `account_information`)
- Actions (`initiate`, `confirm`)
- Monetary amounts with currency
- Creditor name and account

This enables PSD2 compliance, Open Banking interop, and machine-readable audit trails for financial operations.

### 12. Step-Up Authentication (CIBA)

RED-tier operations trigger Client-Initiated Backchannel Authentication through Auth0 Guardian. The agent blocks until the user explicitly approves or denies from their mobile device. The binding message contains transaction details ("Do you want to buy 2 AirPods?"). No silent financial transactions.

### 13. Credential Lifecycle Management

`credentialsContext` is the core security primitive controlling how long credentials persist:

| Context | Scope | Used For |
|---------|-------|----------|
| `thread` | Shared within conversation | Gmail Read, Calendar, Tasks Read, Create Task (performance) |
| `tool-call` | Isolated per invocation | Gmail Write, Delete Task, Complete Task (security) |

Read operations use `thread` for performance. Write operations use `tool-call` for isolation. This is a deliberate security architecture, not a default.

### 14. Automated Security Test Suite

`GET /api/security-test` runs 12 security assertions across 4 categories:

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

**Audit (1 assertion)**
- Audit store is functional (write + read verification + risk level field)

---

## Complete API Surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Streaming chat with tool calling. Accepts `?agentId=reader\|writer` and `?preset=lockdown\|privacy\|productivity` |
| `GET` | `/api/audit` | Fetch audit trail entries and anomaly alerts for the authenticated user |
| `GET` | `/api/audit/verify` | Verify the SHA-256 hash chain integrity of the audit trail |
| `GET` | `/api/agents` | Introspect all agent profiles with tools, policy rules, rate limits, and preset compatibility |
| `GET` | `/api/delegation` | Fetch the delegation chain and active agent session |
| `GET` | `/api/rate-limit` | Check rate limit status for a specific agent (`?agentId=reader`) |
| `GET` | `/api/scope-grants` | List all scope grants with TTL countdown |
| `POST` | `/api/scope-grants` | Renew an existing scope grant |
| `DELETE` | `/api/scope-grants` | Revoke a specific connection's scope grant |
| `POST` | `/api/scope-plan` | Resolve the authorization plan for a set of tool names |
| `GET` | `/api/security-test` | Run 12 automated security assertions |
| `GET` | `/api/token-info` | Inspect JWT claims and token presence (never exposes raw tokens) |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with feature cards, progressive auth flow diagram, and agent selector |
| `/dashboard` | Security score, connected services, audit trail, scope request timeline, policy rules |
| `/security` | Tabbed view: Authorization Matrix, Security Sandbox (12 assertions), Architecture Insights |
| `/profile` | Connected accounts and session management |

---

## Test Coverage

163 passing tests across 8 test files:

| Test File | Tests | What It Covers |
|-----------|-------|---------------|
| `policy-engine.test.ts` | 30 | GREEN/AMBER/RED classification, unknown tool defaults, all rules have required fields |
| `agents.test.ts` | 34 | Agent tool access, isolation boundaries, `cannotAccess` declarations, no tool/cannotAccess overlap |
| `audit.test.ts` | 12 | Hash chaining, genesis hash, user isolation, chronological order, 200-entry cap, chain verification |
| `anomaly-detection.test.ts` | 9 | Rapid escalation, high frequency, alert accumulation, alert clearing |
| `scope-presets.test.ts` | 17 | Lockdown/Privacy/Productivity presets, risk thresholds, tool filtering |
| `scope-presets-integration.test.ts` | 9 | Agent x Preset intersection (Reader+Lockdown=0 tools, Writer+Privacy=0 tools, etc.) |
| `scope-resolver.test.ts` | 14 | Scope aggregation, deduplication, max risk computation, step-up detection, plan formatting |
| `gmail-parser.test.ts` | 38 | JSON/raw/HTML parsing, missing headers, malformed input, snippet truncation, LangChain format |

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
| Progressive authorization | Agent starts with zero permissions; each scope requested individually with explanation |
| Multi-agent credential isolation | 2 agents with hard tool boundaries -- tools physically excluded from LLM context |
| Risk-tier policy engine | GREEN/AMBER/RED classification with auto-approve, warn, and step-up actions |
| Credential lifecycle (`credentialsContext`) | `thread` for reads (performance), `tool-call` for writes (isolation) |
| Token Vault | RFC 8693 token exchange -- agent never sees raw OAuth tokens |
| CIBA step-up authentication | RED-tier actions require mobile push approval via Auth0 Guardian |
| Scope TTL + auto-revocation | Time-based expiry (30m/10m/5m) enforced per risk level |
| Anomaly detection | 4 detection patterns: rapid escalation, high frequency, scope hopping, unusual scope |
| Rate limiting | Per-agent limits tuned by risk level (50/15 calls per 5 minutes) |
| 12 automated security assertions | Isolation, policy, credential, and audit assertions verified on every request |

### 2. User Control

| Feature | Implementation |
|---------|---------------|
| Scope Presets | Lockdown (zero tools), Privacy (read-only), Productivity (full access) |
| Permission Dashboard | Security score, connected services, scope badges, revoke buttons |
| Active Scopes Bar | Real-time zero-trust display showing current authorization state |
| Branded authorization cards | Custom consent UI with service name, risk level, data access description |
| Manual scope revocation | `DELETE /api/scope-grants` to revoke any connection instantly |
| Agent selection | User chooses which agent (Reader/Writer) to interact with |
| Audit trail visibility | Every tool call visible with scopes, risk level, and outcome |

### 3. Technical Execution

| Feature | Implementation |
|---------|---------------|
| Auth0 AI SDK integration | `withTokenVault()` for 3 Google service connections, `withAsyncAuthorization()` for CIBA |
| Vercel AI SDK streaming | `streamText` + `createUIMessageStream` + `withInterruptions` for interrupt-driven consent |
| RFC 8693 token exchange | Token Vault credential brokering without exposing raw tokens |
| RFC 9396 Rich Authorization Requests | Structured authorization details for financial operations |
| SHA-256 hash chains | Tamper-evident audit trail and delegation chains |
| Scope dependency resolver | Computes minimal authorization plans with risk aggregation |
| 163 passing tests | 8 test files covering policy, isolation, audit, anomaly detection, presets, resolver |
| 12 API endpoints | Full REST API for all security subsystems |
| Auth0 Actions | Post-Login token enrichment + Token Exchange scope gating |

### 4. Design

| Feature | Implementation |
|---------|---------------|
| Dark-mode UI | Consistent design across all pages |
| Security score gauge | Computed 0-100 score based on active scopes and risk profile |
| Color-coded scope badges | Green (read), amber (write), red (admin) |
| Agent selector cards | Visual risk indicators per agent |
| Scope Presets selector | Three-mode toggle with color-coded states |
| Active Scopes Bar | Progressive zero-trust to authorized visualization |
| Branded consent cards | Custom authorization UI replacing generic OAuth popups |
| Security tabs | Matrix, Sandbox, and Insights in a unified security view |

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
