# gatewaystack-chatgpt-starter

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

A **5-minute starter** for building OAuth-protected **MCP tool servers** that work in ChatGPT — with **real user-scoped access**.

This repo is the “front door” for the three-party system:

**User → ChatGPT (LLM) → Your MCP Server → (optional) Your Backend**

It handles:
- OAuth discovery (so ChatGPT prompts login when needed)
- JWT verification + per-tool scope enforcement
- Mapping the OAuth subject → your internal user id (`uid`)
- Forwarding the **same OAuth access token** downstream (Pattern 1 / end-to-end OAuth)

---

## Who this is for

This starter is designed for teams building **ChatGPT tools that act on behalf of real users**.

Typical use cases:
- Internal tools for employees via **ChatGPT Enterprise**
- AI agents that need **user-scoped access** to company data
- Platforms that require **SSO, auditing, and per-tool permissions**
- Teams that want a **reference OAuth + MCP implementation** (not a toy plugin)

If you only need a shared API-key tool, this is probably more than you need.
If you need **real identity and authorization**, this is the right pattern.

---

## What you get

✅ MCP JSON-RPC endpoints (`initialize`, `tools/list`, `tools/call`) at `POST /mcp`  
✅ OAuth discovery endpoints (`/.well-known/*`) for ChatGPT OAuth discovery  
✅ JWT verification via `@gatewaystack/identifiabl` (issuer/audience/JWKS)  
✅ Per-tool scope enforcement  
✅ Tool execution proxy via `@gatewaystack/proxyabl` (optional)  
✅ Structured request logging via `@gatewaystack/explicabl`

---

## How it works

> MCP (Model Context Protocol) is the current mechanism ChatGPT uses to connect to external tools with structured inputs, outputs, and authentication.

When ChatGPT calls your MCP server:

1) ChatGPT hits `tools/list` or `tools/call` with a Bearer token  
2) This server:
- verifies the JWT (JWKS / issuer / audience)
- enforces tool scopes (per tool)
- maps `sub` → `uid`
3) Tool execution:
- **Hello World tools** can run locally (pure functions)
- OR you can forward to a backend using Proxyabl (and the backend verifies the same JWT)

**Pattern 1 (recommended for starters): OAuth token all the way through**
- Gateway verifies the JWT
- Gateway forwards the same `Authorization: Bearer …` token to your backend
- Backend verifies JWT again and uses `sub` (or mapped `uid`) for user-scoped access

---

## Authentication & identity providers

This starter is **IdP-agnostic**. It works with any OAuth 2.0 / OIDC provider
that can issue **JWT access tokens (JWS)**.

Guides included:
- **Auth0** → [AUTH0_SETUP.md](./AUTH0_SETUP.md)
- **Other IdPs (Okta, Azure AD, Google, etc.)** → [OTHER_IDPS.md](./OTHER_IDPS.md)

The gateway enforces:
- issuer
- audience
- JWKS signature verification
- per-tool scopes

You keep full control over identity mapping and authorization logic.

---

## Endpoints

### MCP
- `POST /mcp`

### OAuth discovery
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/openid-configuration`

### Debug
- `GET /` (health)
- `GET /debug-token` (verifies the bearer token and shows `sub/aud/scope`)

---

## Quick Start (3 steps)
```bash
   git clone https://github.com/davidcrowe/gatewaystack-chatgpt-starter
   cd gatewaystack-chatgpt-starter
   npm install
   cp .env.example .env
   # Edit .env with your OAuth config
   npm run dev
```

## Try it live (no code required)

You can connect ChatGPT directly to a **live deployed demo** of this MCP server
to see OAuth + user identity working end-to-end.

The demo uses the same code and deployment pattern you would use in production.

👉 See **[LIVE_DEMO.md](./LIVE_DEMO.md)**

What you’ll see:
- ChatGPT prompting for OAuth login
- Tools becoming available after login
- `whoami` returning your real user identity, scopes, and permissions

This is the fastest way to understand how the system works.

## Deployment options

This repo supports multiple deployment styles:

- **Local development** (Express server)
- **Cloud Run via Cloud Build (CI/CD from GitHub)** ← recommended
- Any Node-compatible container runtime

👉 See **[DEPLOY_YOUR_OWN.md](./DEPLOY_YOUR_OWN.md)** for:
- CI/CD setup
- Cloud Run configuration
- How to confirm your revision is live
- Common deployment pitfalls

---

## Demo tools (Hello World)
This starter ships with two tools:

- `whoami` → proves user identity is flowing (returns uid, sub, scopes)
- `echo` → echoes back a message

Tool definitions live in:

- `src/tools/tools.ts`

---

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

---

## Common issues
- **401 + invalid_token**: issuer/audience mismatch, or JWKS not reachable
- **ACCESS_TOKEN_IS_ENCRYPTED_JWE**: your auth provider is returning JWE; you need a JWS access token
- **tools/list keeps prompting OAuth**: ChatGPT isn't seeing a valid `WWW-Authenticate` header (check `/.well-known/oauth-protected-resource` + your `buildWwwAuthenticate()`)

---

## Repo layout
- `src/gateway/toolGateway.ts` → main HTTP handler (MCP + well-known + REST tools)
- `src/handlers/*` → auth helpers, MCP handler, well-known handlers, misc helpers
- `src/tools/tools.ts` → tool pack (scopes + descriptors + output shaping)
- `src/server/expressServer.ts` → local dev server

## Documentation

- **Live demo** → [docs/live-demo.md](./docs/live-demo.md)
- **Deploy your own instance** → [docs/deploy-your-own.md](./docs/deploy-your-own.md)
- **Auth0 setup** → [docs/auth0-setup-guide.md](./docs/auth0-setup-guide.md)
- **Other identity providers** → [docs/other-idps.md](./docs/other-idps.md)
- **Troubleshooting** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Backend integration pattern** → [docs/backend-integration-pattern.md](./docs/backend-integration-pattern.md)
- **Env config guide** → [docs/env-config-guide.md](./docs/env-config-guide.md)

---

Built by **[reducibl applied AI studio](https://reducibl.com)**  
and powered by **[GatewayStack](https://github.com/gatewaystack)**.

This repo is intended to be **forked and adapted**.
It encodes a production-tested pattern for OAuth-protected MCP tools,
so you don’t have to rediscover the hard parts yourself.

If you’re building serious AI systems that need identity, authorization,
and auditability, this is the foundation we use ourselves.

## MCP Tool Server OAuth Flow

<svg viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#333" />
    </marker>
    <marker id="arrowhead-dashed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#666" />
    </marker>
  </defs>
  
  <!-- Title -->
  <text x="500" y="30" font-size="20" font-weight="bold" text-anchor="middle" fill="#1a1a1a">
    MCP Tool Server OAuth Flow
  </text>
  
  <!-- Actors -->
  <g id="user">
    <rect x="50" y="60" width="100" height="40" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2" rx="5"/>
    <text x="100" y="85" font-size="14" font-weight="bold" text-anchor="middle" fill="white">User</text>
    <line x1="100" y1="100" x2="100" y2="750" stroke="#4A90E2" stroke-width="2" stroke-dasharray="5,5"/>
  </g>
  
  <g id="chatgpt">
    <rect x="250" y="60" width="100" height="40" fill="#10A37F" stroke="#0D8A6A" stroke-width="2" rx="5"/>
    <text x="300" y="85" font-size="14" font-weight="bold" text-anchor="middle" fill="white">ChatGPT</text>
    <line x1="300" y1="100" x2="300" y2="750" stroke="#10A37F" stroke-width="2" stroke-dasharray="5,5"/>
  </g>
  
  <g id="gateway">
    <rect x="450" y="60" width="120" height="40" fill="#E94B3C" stroke="#C93B2C" stroke-width="2" rx="5"/>
    <text x="510" y="85" font-size="14" font-weight="bold" text-anchor="middle" fill="white">MCP Gateway</text>
    <line x1="510" y1="100" x2="510" y2="750" stroke="#E94B3C" stroke-width="2" stroke-dasharray="5,5"/>
  </g>
  
  <g id="auth">
    <rect x="650" y="60" width="120" height="40" fill="#9B59B6" stroke="#7D3C98" stroke-width="2" rx="5"/>
    <text x="710" y="85" font-size="14" font-weight="bold" text-anchor="middle" fill="white">OAuth Provider</text>
    <line x1="710" y1="100" x2="710" y2="750" stroke="#9B59B6" stroke-width="2" stroke-dasharray="5,5"/>
  </g>
  
  <g id="backend">
    <rect x="850" y="60" width="100" height="40" fill="#F39C12" stroke="#D68910" stroke-width="2" rx="5"/>
    <text x="900" y="85" font-size="14" font-weight="bold" text-anchor="middle" fill="white">Backend</text>
    <line x1="900" y1="100" x2="900" y2="750" stroke="#F39C12" stroke-width="2" stroke-dasharray="5,5"/>
  </g>
  
  <!-- Flow Steps -->
  <g id="step1">
    <line x1="100" y1="140" x2="290" y2="140" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="195" y="135" font-size="12" text-anchor="middle" fill="#333">1. User asks ChatGPT</text>
    <text x="195" y="150" font-size="11" text-anchor="middle" fill="#666">to use a tool</text>
  </g>
  
  <g id="step2">
    <line x1="300" y1="180" x2="500" y2="180" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="400" y="175" font-size="12" text-anchor="middle" fill="#333">2. tools/list (no token)</text>
  </g>
  
  <g id="step3">
    <line x1="500" y1="220" x2="310" y2="220" stroke="#E94B3C" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="405" y="215" font-size="12" text-anchor="middle" fill="#E94B3C">3. 401 + WWW-Authenticate</text>
    <text x="405" y="230" font-size="11" text-anchor="middle" fill="#999">(OAuth discovery info)</text>
  </g>
  
  <g id="step4">
    <line x1="300" y1="270" x2="700" y2="270" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="500" y="265" font-size="12" text-anchor="middle" fill="#333">4. Redirect to OAuth login</text>
  </g>
  
  <g id="step5">
    <line x1="710" y1="310" x2="110" y2="310" stroke="#9B59B6" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="410" y="305" font-size="12" text-anchor="middle" fill="#9B59B6">5. User authenticates</text>
  </g>
  
  <g id="step6">
    <line x1="100" y1="350" x2="700" y2="350" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="400" y="345" font-size="12" text-anchor="middle" fill="#333">6. Consent & authorize</text>
  </g>
  
  <g id="step7">
    <line x1="710" y1="390" x2="310" y2="390" stroke="#9B59B6" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="510" y="385" font-size="12" text-anchor="middle" fill="#9B59B6">7. OAuth token returned</text>
    <text x="510" y="400" font-size="11" text-anchor="middle" fill="#999">(JWT with scopes)</text>
  </g>
  
  <g id="step8">
    <line x1="300" y1="440" x2="500" y2="440" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="400" y="435" font-size="12" text-anchor="middle" fill="#333">8. tools/list</text>
    <text x="400" y="450" font-size="11" text-anchor="middle" fill="#666">Authorization: Bearer {token}</text>
  </g>
  
  <g id="step9">
    <rect x="480" y="470" width="60" height="30" fill="#FFF3CD" stroke="#FFC107" stroke-width="1" rx="3"/>
    <text x="510" y="490" font-size="11" text-anchor="middle" fill="#856404">Verify JWT</text>
  </g>
  
  <g id="step10">
    <line x1="500" y1="520" x2="310" y2="520" stroke="#10A37F" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="405" y="515" font-size="12" text-anchor="middle" fill="#10A37F">9. Available tools</text>
    <text x="405" y="530" font-size="11" text-anchor="middle" fill="#999">(filtered by scopes)</text>
  </g>
  
  <g id="step11">
    <line x1="300" y1="570" x2="500" y2="570" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="400" y="565" font-size="12" text-anchor="middle" fill="#333">10. tools/call</text>
    <text x="400" y="580" font-size="11" text-anchor="middle" fill="#666">Authorization: Bearer {token}</text>
  </g>
  
  <g id="step12">
    <rect x="480" y="600" width="60" height="30" fill="#FFF3CD" stroke="#FFC107" stroke-width="1" rx="3"/>
    <text x="510" y="615" font-size="11" text-anchor="middle" fill="#856404">Verify JWT</text>
    <text x="510" y="625" font-size="10" text-anchor="middle" fill="#856404">Check scopes</text>
  </g>
  
  <g id="step13">
    <line x1="510" y1="650" x2="890" y2="650" stroke="#666" stroke-width="2" stroke-dasharray="5,5" marker-end="url(#arrowhead-dashed)"/>
    <text x="700" y="645" font-size="12" text-anchor="middle" fill="#666">11. Forward token</text>
    <text x="700" y="660" font-size="11" text-anchor="middle" fill="#999">(optional)</text>
  </g>
  
  <g id="step14">
    <line x1="890" y1="690" x2="520" y2="690" stroke="#F39C12" stroke-width="2" stroke-dasharray="5,5" marker-end="url(#arrowhead-dashed)"/>
    <text x="705" y="685" font-size="12" text-anchor="middle" fill="#F39C12">12. User data</text>
  </g>
  
  <g id="step15">
    <line x1="500" y1="730" x2="310" y2="730" stroke="#10A37F" stroke-width="2" marker-end="url(#arrowhead)"/>
    <text x="405" y="725" font-size="12" text-anchor="middle" fill="#10A37F">13. Tool result</text>
  </g>
  
  <!-- Legend -->
  <g id="legend">
    <rect x="50" y="770" width="900" height="25" fill="#F8F9FA" stroke="#DEE2E6" stroke-width="1" rx="3"/>
    <text x="60" y="787" font-size="11" fill="#495057">
      <tspan font-weight="bold">Key:</tspan>
      <tspan x="110">Solid lines = Required flow</tspan>
      <tspan x="280">Dashed lines = Optional backend integration</tspan>
      <tspan x="560">Yellow boxes = JWT verification points</tspan>
    </text>
  </g>
</svg>