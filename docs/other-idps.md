# Using Other Identity Providers

GatewayStack works with **any OIDC-compliant identity provider** that issues RS256-signed JWT access tokens. This guide covers the most common providers.

For Auth0 specifically, see the dedicated [Auth0 Setup Guide](auth0-setup-guide.md).

---

## Requirements (all providers)

Your IdP must provide:

- **JWT access tokens (JWS)** — not opaque tokens. GatewayStack validates the JWT signature directly.
- **RS256 signing** — asymmetric RSA with SHA-256. GatewayStack fetches the public key from your IdP's JWKS endpoint.
- **`iss` claim** — identifies the token issuer. Must match your `OAUTH_ISSUER` exactly.
- **`aud` claim** — identifies the intended audience. Must match your `OAUTH_AUDIENCE` exactly.
- **JWKS endpoint** — usually at `{issuer}/.well-known/jwks.json`, auto-discovered via OIDC.

Set these environment variables for any provider:

```bash
OAUTH_ISSUER=https://your-issuer.example.com/
OAUTH_AUDIENCE=your-api-identifier
```

If your provider doesn't support standard OIDC discovery, set `JWKS_URI` explicitly:

```bash
JWKS_URI=https://your-issuer.example.com/.well-known/jwks.json
```

---

## Okta

### Setup

1. **Create an Authorization Server** (or use the `default` one):
   - Go to **Security → API → Authorization Servers**
   - Note the **Issuer URI** — this is your `OAUTH_ISSUER`

2. **Create an Application:**
   - Go to **Applications → Create App Integration**
   - Select **OIDC - OpenID Connect** → **Web Application**
   - Set **Sign-in redirect URIs:**
     ```
     https://chat.openai.com/*
     https://chatgpt.com/*
     https://claude.ai/*
     http://localhost:3000/callback
     ```
   - Set **Sign-out redirect URIs:** (optional, same origins)

3. **Add scopes:**
   - Go to **Security → API → your Authorization Server → Scopes**
   - Add each tool scope: `starter.whoami`, `starter.echo`, `starter.notes`, `starter.crm`

4. **Create an Access Policy:**
   - Go to **Security → API → your Authorization Server → Access Policies**
   - Create a policy that grants your application access to the scopes

### Environment variables

```bash
# Okta uses /oauth2/default (or /oauth2/{authServerId}) in the issuer
OAUTH_ISSUER=https://your-org.okta.com/oauth2/default

# The audience for your authorization server
OAUTH_AUDIENCE=api://default
```

### Gotchas

- Okta's **Org Authorization Server** issues opaque tokens, not JWTs. You must use a **Custom Authorization Server** (the `default` one works).
- The issuer URL includes the authorization server path — `https://your-org.okta.com/oauth2/default`, not just `https://your-org.okta.com`.
- Scopes must be added to the authorization server, not just the application.

---

## Microsoft Entra ID (Azure AD)

### Setup

1. **Register an application:**
   - Go to **Azure Portal → Microsoft Entra ID → App registrations → New registration**
   - Set **Redirect URIs** (Web platform):
     ```
     https://chat.openai.com/*
     https://chatgpt.com/*
     https://claude.ai/*
     http://localhost:3000/callback
     ```

2. **Expose an API:**
   - Go to your app → **Expose an API**
   - Set **Application ID URI** (e.g., `api://gatewaystack-mcp`) — this is your `OAUTH_AUDIENCE`
   - Add scopes: `starter.whoami`, `starter.echo`, `starter.notes`, `starter.crm`

3. **Grant API permissions:**
   - Go to **API permissions → Add a permission → My APIs**
   - Select your API and check the scopes
   - Click **Grant admin consent** (if required by your org)

4. **Configure token:**
   - Go to **Manifest** and ensure `accessTokenAcceptedVersion` is `2` (not `null` or `1`)
   - Version 2 tokens use the standard `iss` format

### Environment variables

```bash
# v2 endpoint format
OAUTH_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0

# The Application ID URI you set in "Expose an API"
OAUTH_AUDIENCE=api://gatewaystack-mcp
```

### Gotchas

- **Token version matters.** Version 1 tokens (`accessTokenAcceptedVersion: null` or `1`) have a different `iss` format (`https://sts.windows.net/{tenant-id}/`). Version 2 tokens use `https://login.microsoftonline.com/{tenant-id}/v2.0`. Make sure your `OAUTH_ISSUER` matches the version.
- **Multi-tenant apps** use a different issuer pattern. For single-tenant (recommended for GatewayStack), use your specific tenant ID.
- Scopes in Entra ID are prefixed with the Application ID URI — the full scope looks like `api://gatewaystack-mcp/starter.whoami`. GatewayStack checks the `scp` or `roles` claim, which contains the short form.

---

## Clerk

### Setup

1. **Create a Clerk application** at [clerk.com](https://clerk.com)

2. **Configure JWT Templates:**
   - Go to **Dashboard → JWT Templates → Create new**
   - Select **Blank** template
   - Set the `aud` claim to your API identifier (e.g., `gatewaystack-mcp`)
   - Ensure the signing algorithm is RS256

3. **Add allowed origins:**
   - Go to **Dashboard → Settings → Paths**
   - Verify your MCP client origins are allowed

### Environment variables

```bash
# The Frontend API URL from your Clerk dashboard
OAUTH_ISSUER=https://your-app.clerk.accounts.dev/

# The audience you configured in your JWT template
OAUTH_AUDIENCE=gatewaystack-mcp
```

### Gotchas

- Clerk issues JWTs from the **Frontend API URL**, not a separate authorization server. The issuer is your Clerk domain.
- Scopes in Clerk are managed through **Roles and Permissions** or custom claims in JWT templates, not through a traditional OAuth scope grant flow.
- You may need to use Clerk's `getToken({ template: "your-template" })` on the client side to get tokens with your custom audience.

---

## Google Identity

### Setup

1. **Create OAuth credentials:**
   - Go to **Google Cloud Console → APIs & Services → Credentials**
   - Create an **OAuth 2.0 Client ID** (Web application)
   - Set **Authorized redirect URIs:**
     ```
     https://chat.openai.com/callback
     https://chatgpt.com/callback
     http://localhost:3000/callback
     ```

2. **Configure consent screen:**
   - Go to **OAuth consent screen**
   - Add your scopes (Google uses its own scope format)

### Environment variables

```bash
OAUTH_ISSUER=https://accounts.google.com

# Your OAuth Client ID
OAUTH_AUDIENCE=123456789-abcdefg.apps.googleusercontent.com
```

### Gotchas

- Google's `id_token` is a JWT, but the `access_token` is typically **opaque**. GatewayStack needs a JWT access token. You may need to use the `id_token` flow instead or configure Google to issue JWT access tokens for your API.
- Custom scopes aren't straightforward with Google OAuth. For tool-level authorization, consider using Google groups/roles mapped via a custom claim.
- Google OAuth is better suited for authentication (proving who the user is) than for fine-grained API authorization. If you need per-tool scopes, consider using Auth0 or Okta with Google as a social connection.

---

## Keycloak

### Setup

1. **Create a realm** (or use an existing one)

2. **Create a client:**
   - Go to **Clients → Create client**
   - Client type: **OpenID Connect**
   - Set **Valid redirect URIs:**
     ```
     https://chat.openai.com/*
     https://chatgpt.com/*
     https://claude.ai/*
     http://localhost:3000/*
     ```

3. **Create client scopes:**
   - Go to **Client scopes → Create**
   - Create scopes for each tool: `starter.whoami`, `starter.echo`, etc.
   - Assign them to your client under **Clients → your client → Client scopes**

4. **Configure token:**
   - Ensure access tokens use RS256 signing (Realm Settings → Keys)

### Environment variables

```bash
# Keycloak issuer includes the realm path
OAUTH_ISSUER=https://your-keycloak.example.com/realms/your-realm

# The client ID or a custom audience mapper
OAUTH_AUDIENCE=gatewaystack-mcp
```

### Gotchas

- Keycloak's issuer includes the realm path — don't forget `/realms/your-realm`.
- By default, Keycloak puts the `client_id` in the `aud` claim. To use a custom audience, add an **Audience mapper** to your client (Clients → your client → Client scopes → Dedicated → Mappers → Add mapper → Audience).
- Keycloak scopes appear in the `scope` claim by default. Permissions/roles may appear in `realm_access.roles` or `resource_access.{client}.roles` — GatewayStack checks the `scope` claim, so use client scopes rather than role mappings.

---

## Subject mapping

Regardless of provider, GatewayStack maps the OAuth `sub` claim to an internal user identifier. The default implementation in `src/handlers/authHelpers.ts`:

```typescript
async function subjectToUid(sub: string, email?: string): Promise<string> {
  return `auth0:${sub}`;
}
```

Customize for your provider:

```typescript
// Okta: sub is already a stable user ID
return `okta:${sub}`;

// Entra ID: sub is an opaque pairwise ID, prefer oid claim
return `entra:${oid || sub}`;

// Keycloak: sub is a UUID
return `kc:${sub}`;
```

The demo CRM uses a further HMAC step (`src/demo-api/crm/identity.ts`) to derive non-reversible keys from the subject, preventing PII storage.

---

## Multi-IdP setups

The starter defaults to **one issuer** for safety — every token must come from `OAUTH_ISSUER`. This prevents token substitution attacks.

For multi-IdP scenarios (e.g., Auth0 for external users, Okta for internal):

- **Recommended:** Run separate deployments per IdP, behind a load balancer that routes by audience or client.
- **Advanced:** Accept multiple issuers by extending the JWT verification in `src/handlers/authHelpers.ts` to check against a list of trusted issuers. Each issuer needs its own JWKS cache.

Do **not** disable issuer verification in production unless you fully control all token sources and understand the security implications.
