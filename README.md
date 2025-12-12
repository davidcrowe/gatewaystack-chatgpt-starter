# gatewaystack-chatgpt-starter

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**Expose internal tools to LLMs — securely**  

Give your users secure access to *their* data from inside of ChatGPT

> **Test it yourself in ChatGPT** with no code → [live-demo.md](./docs/live_demo.md)

Modern AI apps involve three actors — the **user**, the **LLM**, and **your backend** — yet there is no shared identity layer binding them together. This creates user-scoped data, policy, and audit gaps.

- Users want AI to access *their* data (ChatGPT reading *my* calendar). 
- Enterprises want to control *who* can use AI models (only doctors can use medical models, only directors can send sensitive prompts). 
- Auditors want to know *who* asked *which* model to do *what* and *when* 

Both the LLM and your backend require **cryptographic proof of user identity** tied to every AI request... but AI platforms authenticate users on their side while your backend has no verified identity to enforce policies, filter data, or log actions. This is the [three-party problem](https://github.com/davidcrowe/GatewayStack/blob/main/docs/three-party-problem.md).

This repo implements a solution to the three-party problem. This starter code builds **MCP tool servers** to make your tools and apps available inside of ChatGPT with **real user-scoped access**.

**User → ChatGPT (LLM) → Your MCP Server → Your Backend**

This repo handles:
- OAuth discovery (so ChatGPT prompts login when needed)
- JWT verification + per-tool scope enforcement
- Mapping the OAuth subject → your internal user id (`uid`)
- Forwarding the **same OAuth access token** downstream (end-to-end OAuth)

## Try it live (no code required)

<video src="https://github.com/user-attachments/assets/aa14fce5-442d-4fec-9a76-33d20e5b2ae0" controls width="100%"></video>

Connect ChatGPT directly to a **[live deployed demo](./docs/live_demo.md)** of this MCP server to see OAuth + user identity working end-to-end.

The demo runs this exact codebase on Cloud Run via Cloud Build CI/CD. It lets you experience the full MCP + OAuth flow without cloning, deploying, or configuring anything yourself.

It's ideal for demos, evaluations, internal pilots, and understanding how ChatGPT MCP + OAuth actually works in practice.

## Quick Start
```bash
   git clone https://github.com/davidcrowe/gatewaystack-chatgpt-starter
   cd gatewaystack-chatgpt-starter
   npm install
   cp .env.example .env
   # Edit .env with your OAuth config
   npm run dev
```

## Who this is for
This starter is designed for teams building **ChatGPT tools that act on behalf of real users**.

Typical use cases:
- Make internal tools available to employees via **ChatGPT Enterprise**
- AI agents that need **user-scoped access** to company data
- Internal AI platforms that require **SSO, auditing, and per-tool permissions**
- Teams looking for a **reference OAuth + MCP implementation**

If you only need a shared API-key tool, this is probably more than you need.
If you don't need user-scoped data access for your resource or tool, this is more than you need.

If you need **real identity and authorization**, this is the right pattern.
If you want people to access their data from your multi-tenant database through ChatGPT, this is for you.

## What you get
- MCP JSON-RPC endpoints (`initialize`, `tools/list`, `tools/call`) at `POST /mcp`  
- OAuth discovery endpoints (`/.well-known/*`) for ChatGPT OAuth discovery  
- JWT verification via `@gatewaystack/identifiabl` (issuer/audience/JWKS)  
- End-to-end Request Context object 
- Per-tool scope enforcement  
- Tool execution proxy via `@gatewaystack/proxyabl`
- Structured Request Context logging via `@gatewaystack/explicabl`

## Why this repo exists

Most MCP examples ignore identity, authorization, and auditability.
This repo exists to establish the minimum viable security baseline for real AI tools.

## How it works
> MCP (Model Context Protocol) is the current mechanism ChatGPT uses to connect to external tools with structured inputs, outputs, and authentication.

### OAuth Flow Diagram
![OAuth Flow Diagram](https://raw.githubusercontent.com/davidcrowe/gatewaystack-chatgpt-starter/main/docs/oauth-flow-diagram.svg)

When ChatGPT calls your MCP server:

1) ChatGPT hits `tools/list` or `tools/call` with a Bearer token  
2) This server:
- verifies the JWT (JWKS / issuer / audience)
- enforces tool scopes (per tool)
- maps `sub` → `uid`
3) Tool execution:
- **Hello World tools** can run locally (pure functions)
- OR you can forward to a backend using Proxyabl (the backend verifies the same JWT)

**OAuth token all the way through**
- Gateway verifies the JWT
- Gateway forwards the same `Authorization: Bearer …` token to your backend
- Backend verifies JWT again and uses `sub` (or mapped `uid`) for user-scoped access

## Authentication & identity providers
This starter is **IdP-agnostic**. It works with any OAuth 2.0 / OIDC provider
that can issue **JWT access tokens (JWS)**.

Guides included:
- **Auth0** → [auth0-setup-guide.md](./docs/auth0-setup-guide.md)
- **Other IdPs (Okta, Azure AD, Google, etc.)** → [other-idps.md](./docs/other-idps.md)

The gateway enforces:
- issuer
- audience
- JWKS signature verification
- per-tool scopes

You keep full control over identity mapping and authorization logic.

## Endpoints
### MCP
- `POST /mcp`

### OAuth discovery
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/openid-configuration`

### Debug
- `GET /` (health)
- `GET /debug-token` (verifies the bearer token and shows `sub/aud/scope`)

## Deployment options
This repo supports multiple deployment styles:

- **Local development** (Express server)
- **Cloud Run via Cloud Build (CI/CD from GitHub)** ← recommended
- Any Node-compatible container runtime

See **[deploy-your-own.md](./docs/deploy-your-own.md)** for:
- CI/CD setup
- Cloud Run configuration
- How to confirm your revision is live
- Common deployment pitfalls

## Demo tools (Hello World)
This starter ships with two tools:

- `whoami` → proves user identity is flowing (returns uid, sub, scopes)
- `echo` → echoes back a message

Tool definitions live in:

- `src/tools/tools.ts`

## Customize for your app
You usually only need to change **three things**:

### 1) Tool registry
- `src/tools/tools.ts`
- define tools + required scopes + MCP descriptors
- optionally add output shaping (summarizeToolResult, formatStructuredForTool, etc.)

### 2) Identity mapping
- `subjectToUid(sub, email?)` in `src/handlers/authHelpers.ts`
- map OAuth subject → your internal user id

### 3) Backend execution (optional)
By default, you can keep tools local for demos.  

If you want a real backend:

- configure Proxyabl to call your backend endpoints
- forward the OAuth token downstream
- verify JWT in your backend and use sub/uid to scope data

## Common issues
- **401 + invalid_token**: issuer/audience mismatch, or JWKS not reachable
- **ACCESS_TOKEN_IS_ENCRYPTED_JWE**: your auth provider is returning JWE; you need a JWS access token
- **tools/list keeps prompting OAuth**: ChatGPT isn't seeing a valid `WWW-Authenticate` header (check `/.well-known/oauth-protected-resource` + your `buildWwwAuthenticate()`)

## Repo layout
- `src/gateway/toolGateway.ts` → main HTTP handler (MCP + well-known + REST tools)
- `src/handlers/*` → auth helpers, MCP handler, well-known handlers, misc helpers
- `src/tools/tools.ts` → tool pack (scopes + descriptors + output shaping)
- `src/server/expressServer.ts` → local dev server

## Documentation
This repo is intended to be **forked and adapted**.
It encodes a production-tested pattern for OAuth-protected MCP tools,
so you don’t have to rediscover the hard parts yourself.

If you’re building serious AI systems that need identity, authorization,
and auditability, this is the foundation we use ourselves.

- **Live demo** → [docs/live-demo.md](./docs/live-demo.md)
- **Deploy your own instance** → [docs/deploy-your-own.md](./docs/deploy-your-own.md)
- **Auth0 setup** → [docs/auth0-setup-guide.md](./docs/auth0-setup-guide.md)
- **Other identity providers** → [docs/other-idps.md](./docs/other-idps.md)
- **Troubleshooting** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Backend integration pattern** → [docs/backend-integration-pattern.md](./docs/backend-integration-pattern.md)
- **Env config guide** → [docs/env-config-guide.md](./docs/env-config-guide.md)

This repository is the reference implementation of **[GatewayStack's](https://github.com/gatewaystack)** identity, authorization, and observability primitives for MCP servers

Built by **[reducibl applied AI studio](https://reducibl.com)**  

[Need help](./docs/consulting.md)? We help teams implement this pattern correctly in weeks instead of months — including IdP integration, security review support, and internal rollout. 