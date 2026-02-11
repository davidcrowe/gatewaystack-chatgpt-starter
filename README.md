<p align="center">
  <img src="./assets/banner.png" alt="GatewayStack banner" />
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0">
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.7-blue" />
  </a>
</p>

<p align="center"><strong>Build your own MCP server with real user identity</strong></p>

<p align="center">A 5-minute starter for building OAuth-protected MCP tool servers with real user-scoped access.<br/>Works with ChatGPT, Claude, and any MCP-compatible client — powered by <a href="https://gatewaystack.com">GatewayStack</a>.</p>

## What this is

A production-ready starter for building MCP servers where **every AI request is tied to a real, verified user**. Fork it, swap in your tools, deploy.

If your tools need to know _which user_ is calling — not just _that someone_ is calling — this is the pattern.

```
User (Alice) → LLM (ChatGPT, Claude, etc.) → Your MCP Server (this repo) → Your Backend
                                                      │
                                                ┌─────┴─────┐
                                                │ verify JWT │
                                                │ check scope│
                                                │ map sub→uid│
                                                │ forward tok│
                                                └────────────┘
```

**Example:** A user asks their AI assistant: *"Show me my Q4 sales data."* The LLM calls your MCP server. But your backend has no cryptographic proof of *which* user is asking. Without identity enforcement, most teams use a shared API key — which means every user sees everyone's data.

This starter solves that with end-to-end OAuth: the user's JWT flows from the LLM client through your MCP server to your backend, verified at every hop. Learn more about the [three-party identity problem](https://gatewaystack.com/docs/three-party-problem).

## Part of GatewayStack

This starter is the quickest way to get a working [GatewayStack](https://github.com/davidcrowe/gatewaystack) server running. GatewayStack is an open-source agentic control plane that makes AI agents enterprise-ready by enforcing user-scoped identity, policy, and audit trails across every tool call.

The full GatewayStack pipeline:

| Layer | Package | This Starter |
|-------|---------|:------------:|
| Identity | `@gatewaystack/identifiabl` | Included |
| Validation | `@gatewaystack/validatabl` | — |
| Transformation | `@gatewaystack/transformabl` | — |
| Rate Limiting | `@gatewaystack/limitabl` | — |
| Proxying | `@gatewaystack/proxyabl` | Included |
| Observability | `@gatewaystack/explicabl` | Included |

This starter demonstrates the identity + proxy + logging layers. For the full control plane, see the [main GatewayStack repo](https://github.com/davidcrowe/gatewaystack).

## Quick start

```bash
git clone https://github.com/davidcrowe/gatewaystack-chatgpt-starter
cd gatewaystack-chatgpt-starter
npm install
cp .env.example .env   # edit with your OAuth config
npm run dev
```

## What's included

| Layer | What it does | Powered by |
|-------|-------------|------------|
| **OAuth discovery** | `/.well-known/*` endpoints so MCP clients prompt login | built-in |
| **JWT verification** | RS256/JWKS verification of access tokens | `@gatewaystack/identifiabl` |
| **Scope enforcement** | per-tool scope declarations, deny if missing | built-in |
| **Identity mapping** | OAuth `sub` → your internal `uid` | built-in |
| **Token forwarding** | same Bearer token forwarded to your backend | `@gatewaystack/proxyabl` |
| **Audit logging** | structured request context logging | `@gatewaystack/explicabl` |
| **Rate limiting** | per-IP request throttling | `express-rate-limit` |
| **Request context** | identity propagation across async boundaries | `@gatewaystack/request-context` |

## Demo tools

Ships with working demos that prove the identity pattern end-to-end:

| Tool | What it proves |
|------|---------------|
| `whoami` | OAuth identity flows through the full chain |
| `echo` | basic tool execution with scope enforcement |
| `seedMyNotes` / `listMyNotes` / `addNote` | user-scoped data isolation (in-memory) |
| `crmInit` / `crmGetSalesSummary` | user-scoped SQLite CRM with HMAC-derived keys |
| `crmExplainAccess` / `crmAttemptCrossUserRead` | cross-user access denial proof |

## Customize for your app

You need to change **three things**:

### 1. Tool registry (`src/tools/tools.ts`)
Define your tools, their required scopes, and MCP descriptors.

### 2. Identity mapping (`src/handlers/authHelpers.ts`)
Map OAuth `sub` → your internal user id in `subjectToUid()`.

### 3. Backend execution (optional)
Keep tools local for demos, or configure Proxyabl to forward requests to your real backend with the OAuth token attached.

## Architecture

```
src/
├── gateway/toolGateway.ts        # main HTTP handler (MCP + REST + well-known)
├── handlers/
│   ├── authHelpers.ts            # JWT verify, scope check, identity mapping
│   ├── mcpHandler.ts             # MCP JSON-RPC (initialize, tools/list, tools/call)
│   ├── oauthConfig.ts            # OAuth env config (issuer, audience, JWKS)
│   ├── wellKnown.ts              # OAuth discovery endpoints
│   └── httpHelpers.ts            # CORS, fetch helpers
├── server/expressServer.ts       # Express app + rate limiting
├── tools/tools.ts                # tool registry + scope map + MCP descriptors
├── demo-api/                     # demo backend (notes + CRM)
│   ├── crm/                      # SQLite CRM with HMAC user keys
│   └── store.ts                  # in-memory note storage
└── tests/                        # vitest unit tests
```

## Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/mcp` | POST | MCP JSON-RPC (tools/list, tools/call, initialize) |
| `/.well-known/oauth-protected-resource` | GET | OAuth discovery for MCP clients |
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata |
| `/.well-known/openid-configuration` | GET | OIDC discovery (proxied) |
| `/` | GET | Health check + service info |
| `/debug-token` | GET | Verify bearer token, show claims |

## Deployment

- **Local**: `npm run dev` (tsx)
- **Cloud Run**: `npm run build && npm start` (recommended)
- Any Node 20+ container runtime

See [docs/deploy-your-own.md](./docs/deploy-your-own.md) for CI/CD setup.

## Auth providers

Works with any OAuth 2.0 / OIDC provider that issues JWT access tokens (JWS):

- [Auth0 setup guide](./docs/auth0-setup-guide.md)
- [Other IdPs (Okta, Azure AD, Google)](./docs/other-idps.md)

## Testing

```bash
npm test          # 26 unit tests (vitest)
npm run build     # TypeScript compilation check
```

## Common issues

| Symptom | Cause |
|---------|-------|
| `401 + invalid_token` | issuer/audience mismatch or JWKS not reachable |
| `ACCESS_TOKEN_IS_ENCRYPTED_JWE` | auth provider returning JWE instead of JWS |
| `tools/list keeps prompting OAuth` | `WWW-Authenticate` header or `/.well-known/oauth-protected-resource` misconfigured |
| Works with ChatGPT but not Claude/other clients | Check that your `/.well-known/oauth-protected-resource` response includes the correct `authorization_endpoint` for your IdP. Different MCP clients may discover OAuth differently |

## What's next

**Add more governance layers:** Install additional GatewayStack modules to add policy enforcement, rate limiting, request transformation, and richer audit trails — all composable with this starter.

**Agentic Control Plane Cloud:** When you need multi-tenant administration, managed deployment, a policy dashboard, and enterprise identity integrations (Auth0, Okta, Entra ID), check out [Agentic Control Plane Cloud](https://agenticcontrolplane.com/product).

**Need help?** We offer consulting and build sessions for teams implementing MCP servers with user-scoped governance. [Book a session](https://reducibl.com)

## Related

- [GatewayStack](https://github.com/davidcrowe/gatewaystack) — open-source agentic control plane
- [gatewaystack.com](https://gatewaystack.com) — the governance platform
- [@gatewaystack packages](https://www.npmjs.com/org/gatewaystack) — npm modules

Built by [reducibl applied AI studio](https://reducibl.com)
