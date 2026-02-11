# Deploy Your Own MCP Server

This guide walks through deploying your **own copy** of the GatewayStack MCP server.

---

## Supported environments

* Google Cloud Run (recommended)
* Any Docker-compatible platform
* Local dev with tunneling (ngrok, cloudflared)

---

## Option A: Cloud Run via GitHub (recommended)

### 1. Fork the repo

Fork:

```
https://github.com/davidcrowe/gatewaystack-chatgpt-starter
```

---

### 2. Create a Cloud Build trigger

In GCP:

* Connect your GitHub repo
* Trigger on `main`
* Use `cloudbuild.yaml`

This ensures **every push creates a new Cloud Run revision**.

---

### 3. Required environment variables

Set these on the Cloud Run service:

```
OAUTH_ISSUER=https://your-tenant.us.auth0.com
OAUTH_AUDIENCE=https://your-api-identifier
NODE_ENV=production
```

Optional:

```
JWKS_URI=https://...
```

---

### 4. Verify deployment

Visit:

```
GET /
GET /.well-known/oauth-protected-resource
```

If these return JSON, MCP clients can discover your server.

---

## Option B: Manual Docker deploy

```bash
docker build -t mcp-server .
docker run -p 3000:3000 \
  -e OAUTH_ISSUER=... \
  -e OAUTH_AUDIENCE=... \
  mcp-server
```

---

## Revision sanity check

This repo logs:

* `K_REVISION`
* `GIT_SHA`

On every request. If these don’t change after a deploy, your platform is not updating revisions correctly.

---

## Next steps

* Replace demo tools with real tools
* Integrate your backend (Pattern 1)
* Lock down scopes per tool

See `AUTH0_SETUP.md` and `OTHER_IDPS.md`.
