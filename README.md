# Scope Lock

**Progressive authorization for AI agents using Auth0 Token Vault.**

AI agents shouldn't get blanket access to your digital life. Scope Lock ensures every permission is earned, explained, and auditable.

**Live Demo:** [https://scope-lock-pi.vercel.app](https://scope-lock-pi.vercel.app)
**Video Demo:** [YouTube Link] _(to be added)_

---

## The Problem

Today's AI agents request broad permissions upfront — "access to Gmail, Calendar, and GitHub" — before doing anything. Users grant everything or nothing. There's no visibility into what the agent actually accesses, no way to revoke individual scopes, and no audit trail.

## The Solution

Scope Lock implements **progressive authorization**: the agent starts with **zero permissions** and requests each scope individually, explaining why it's needed. Every API call is logged. High-risk operations trigger step-up authentication.

```
User: "Check my recent emails"
Agent: "I'll need read-only access to your Gmail (gmail.readonly scope).
        This is brokered through Auth0 Token Vault — I never see your credentials."
        [Token Vault consent popup]
Agent: "Here are your 10 most recent emails..."
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │   Chat   │  │  Profile  │  │    Dashboard     │  │
│  │  Window  │  │  (Manage  │  │  (Security Score │  │
│  │          │  │  accounts)│  │   + Audit Trail) │  │
│  └────┬─────┘  └───────────┘  └──────────────────┘  │
│       │                                              │
│  ┌────▼─────────────────────────────────────────┐    │
│  │         Vercel AI SDK (streaming)            │    │
│  │         OpenAI GPT-4o + Tool Calling         │    │
│  └────┬─────────────────────────────────────────┘    │
│       │                                              │
│  ┌────▼─────────────────────────────────────────┐    │
│  │         Auth0 AI SDK (@auth0/ai-vercel)      │    │
│  │                                               │    │
│  │  withTokenVault()     withAsyncAuthorization() │   │
│  │  ├─ Gmail (read)      └─ CIBA push approval   │   │
│  │  ├─ Gmail (write)         for high-risk ops    │   │
│  │  ├─ Calendar                                   │   │
│  │  ├─ Tasks              credentialsContext:      │   │
│  │  ├─ GitHub              ├─ 'thread' (reads)    │   │
│  │  └─ Slack               └─ 'tool-call' (writes)│  │
│  └────┬─────────────────────────────────────────┘    │
│       │                                              │
│  ┌────▼─────────────────────────────────────────┐    │
│  │              Audit Trail Logger               │    │
│  │  Every tool call → scopes, connection,        │    │
│  │  timestamp, success/failure, credential ctx   │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Auth0 Token Vault                   │
│                                                      │
│  Stores & manages OAuth tokens for:                  │
│  ├─ Google (Gmail, Calendar, Tasks)                  │
│  ├─ GitHub (repos, events)                           │
│  └─ Slack (channels)                                 │
│                                                      │
│  RFC 8693 token exchange — agent never sees raw      │
│  credentials. Tokens are scoped, rotated, revocable. │
└─────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Progressive Authorization
The agent starts with **zero permissions**. Each service access is requested individually with a clear explanation of what scope is needed and why.

### 2. Permission Dashboard (`/dashboard`)
Real-time visibility into:
- **Security Score** (0-100) based on active scopes and risk levels
- **Connected Services** with scope badges (green=read, amber=write, red=admin)
- **Audit Trail** of every API call with timestamps and credential context
- **Revoke** buttons per connection

### 3. Credential Lifecycle Management (`credentialsContext`)
- **Read operations** (`gmail.readonly`, `calendar.events`): credentials shared per-thread for performance
- **Write operations** (`gmail.compose`): per-invocation isolation for security
- **External services** (GitHub, Slack): per-invocation isolation (maximum security)

### 4. Step-Up Authentication (CIBA)
High-risk actions (email drafts, purchases) trigger Client-Initiated Backchannel Authentication — a push notification to the user's mobile device for explicit approval.

### 5. Multi-Service Integration
5 APIs connected through Token Vault:
- **Gmail** — search emails, draft messages
- **Google Calendar** — view events
- **Google Tasks** — list and create tasks
- **GitHub** — list repos, view activity
- **Slack** — list channels

### 6. Audit Trail
Every tool call is logged with:
- Tool name and connection used
- Scopes consumed
- Credential context level
- Success/failure status
- Timestamp

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router, Server Components, API routes |
| Vercel AI SDK | Streaming chat, tool calling, UI messages |
| OpenAI GPT-4o | LLM for agent reasoning |
| Auth0 Token Vault | OAuth token management for third-party APIs |
| Auth0 Connected Accounts | Multi-provider identity linking |
| Auth0 CIBA | Step-up authentication for high-risk operations |
| @auth0/ai-vercel | Token Vault integration, interrupt handling |
| @auth0/nextjs-auth0 | User authentication, session management |
| Tailwind CSS | UI styling |
| Vercel | Deployment |

---

## Setup

### Prerequisites
- Node.js 18+
- Auth0 tenant with Token Vault enabled
- OpenAI API key
- Google OAuth app (for Gmail, Calendar, Tasks)
- GitHub OAuth app (for repos, events)

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
3. Configure Google OAuth2 connection with scopes: `email`, `profile`, `gmail.readonly`, `gmail.send`, `calendar.readonly`, `tasks.readonly`
4. Configure GitHub connection
5. Enable Multi-Resource Refresh Tokens (MRRT)
6. Set Allowed Callback URLs: `http://localhost:3000/auth/callback`

### Install and Run

```bash
cd ts-vercel-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Judging Criteria Mapping

| Criterion | How Scope Lock Addresses It |
|-----------|----------------------------|
| **Security Model** | Progressive authorization, credential isolation via `credentialsContext`, Token Vault (agent never sees raw tokens), CIBA for high-risk ops |
| **User Control** | Permission Dashboard with scope visualization, revoke buttons, audit trail, agent explains every permission request |
| **Technical Execution** | Auth0 AI SDK patterns, RFC 8693 token exchange, 5 API integrations, streaming chat, production deployment on Vercel |
| **Design** | Clean dark-mode UI, security score gauge, color-coded scope badges, responsive layout, polished chat interface |
| **Potential Impact** | Progressive authorization as a reusable pattern for any AI agent. credentialsContext as a model for credential lifecycle management |
| **Insight Value** | Documents credential lifecycle gaps, scope management pain points, and the need for standardized audit trails in agent authorization |

---

## License

MIT
