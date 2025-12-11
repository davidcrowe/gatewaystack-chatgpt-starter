# gatewaystack-chatgpt-starter

A **5-minute starter** for building OAuth-protected **MCP tool servers** that work in ChatGPT — with **real user-scoped access**.

This repo is the “front door” for the three-party system:

**User → ChatGPT (LLM) → Your MCP Server → (optional) Your Backend**

It handles:
- OAuth discovery (so ChatGPT prompts login when needed)
- JWT verification + per-tool scope enforcement
- Mapping the OAuth subject → your internal user id (`uid`)
- Forwarding the **same OAuth access token** downstream (Pattern 1 / end-to-end OAuth)

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

## Quickstart (local)

### 1) Install + configure

```bash
npm i
cp .env.example .env
# fill in OAUTH_ISSUER / OAUTH_AUDIENCE (and optionally scopes)
npm run dev
```

Server defaults to: `http://localhost:3000`

### 2) Sanity check
```bash
curl -s http://localhost:3000/ | jq
curl -s http://localhost:3000/.well-known/oauth-protected-resource | jq
curl -s http://localhost:3000/.well-known/openid-configuration | jq
```

### 3) Connect it to ChatGPT as an MCP server
- Point ChatGPT at your MCP base URL (local via a tunnel, or deploy it)
- Attempt a tool call
- ChatGPT should prompt OAuth login automatically
- After login, `tools/list` and `tools/call` succeed

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