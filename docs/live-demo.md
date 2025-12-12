# Live Demo: Use This MCP Server Without Downloading Code

This guide explains how to **use an already-running gatewaystack MCP server** directly from ChatGPT, without cloning or deploying anything yourself.

> This is ideal for demos, evaluations, and internal pilots.

---

## What you need

* A running deployment of this repo (Cloud Run or similar)
* An OAuth provider configured for that deployment (Auth0, Okta, Entra, etc.)
* A user account in that IdP

You **do not** need:

* The source code
* A local dev environment
* A backend service

---

## MCP base URL

You will be given a base URL that looks like:

```
https://<service>.run.app
```

This server exposes:

* MCP endpoint: `POST /mcp`
* OAuth discovery: `/.well-known/*`

---

## Add it to ChatGPT

1. Open **ChatGPT** (Enterprise or developer-enabled)
2. Add a new **MCP server**
3. Set the MCP URL to:

```
https://<service>.run.app/mcp
```

4. Save

---

## What happens next

1. ChatGPT calls `tools/list`
2. The server responds with `WWW-Authenticate`
3. ChatGPT opens an OAuth login window
4. You log in with your IdP account
5. ChatGPT retries the call with a Bearer token

---

## Verify it works

Try calling the demo tool:

```
whoami
```

You should see:

* your OAuth `sub`
* granted scopes
* permissions mapped to tools

If that works, the full identity + authorization chain is live.

---

## Common demo issues

* **Repeated login prompts** → OAuth discovery misconfigured
* **401 invalid_token** → issuer or audience mismatch
* **No tools listed** → scopes missing from access token

See `TROUBLESHOOTING.md` for details.
