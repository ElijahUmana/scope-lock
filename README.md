# Scope Lock

Scope Lock is a security-focused AI agent that demonstrates progressive authorization using Auth0 Token Vault. It connects to external services (Gmail, Google Calendar, GitHub, Slack) on behalf of the user, requesting only the minimal scopes needed for each action and brokering every API call through Auth0's federated token exchange -- so the AI agent never touches raw credentials.

## Architecture

- **Next.js** -- App router frontend and API routes
- **Vercel AI SDK** -- Streaming tool-calling agent with OpenAI
- **Auth0 Token Vault** -- Federated access tokens for third-party APIs (Google, GitHub, Slack)
- **Auth0 AI SDK + Next.js SDK** -- User authentication and token management
- **Auth0 FGA** -- Fine-grained authorization policies for tools and RAG pipelines
- **Postgres + Drizzle ORM + pgvector** -- Document storage and embeddings (optional)

## What it demonstrates

- **Token Vault** -- The agent obtains scoped access tokens from Auth0 instead of storing credentials directly. Each tool call uses a token with minimal permissions.
- **Connected Accounts** -- Users link their Google, GitHub, and Slack accounts through Auth0. The agent accesses these services on the user's behalf via federated token exchange.
- **Step-up / async authorization** -- For sensitive actions (e.g. online purchases), the agent triggers human-in-the-loop confirmation via Auth0 CIBA (Client Initiated Backchannel Authentication) before proceeding.
- **Progressive authorization** -- Scopes are requested incrementally as needed, not all upfront.

## Setup

### Prerequisites

- Node.js 18+
- An Auth0 tenant with Token Vault configured ([setup guide](https://auth0.com/ai/docs/get-started/call-others-apis-on-users-behalf))
- An OpenAI API key
- Docker (for the optional Postgres database)

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
OPENAI_API_KEY=
```

Optional variables for additional features: FGA store credentials, SerpAPI key, Guardian push (for async auth).

### Install and run

```bash
cd ts-vercel-ai
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For full features including document upload/retrieval:

```bash
docker compose up -d
npm run db:migrate
npm run fga:init
npm run dev
```

## License

MIT -- see [LICENSE](LICENSE).
