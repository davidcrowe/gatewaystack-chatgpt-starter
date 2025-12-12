# Environment Configuration Guide

## Complete `.env` Template with Explanations

```bash
# ============================================================================
# REQUIRED: OAuth Configuration
# ============================================================================

# OAuth Issuer - The authorization server that issues tokens
# This is the base URL of your OAuth/OIDC provider
# Example: https://your-tenant.auth0.com/
# Example: https://accounts.google.com
# Example: https://clerk.your-app.com
OAUTH_ISSUER=https://your-oauth-provider.com/

# OAuth Audience - Identifies this resource server
# This tells the OAuth provider which API/service the token is intended for
# Must match the "audience" (aud) claim in the JWT
# Example: https://api.yourapp.com
# Example: your-api-identifier
OAUTH_AUDIENCE=your-api-identifier

# ============================================================================
# OPTIONAL: Scope Configuration
# ============================================================================

# Required Scopes - Space-separated list of OAuth scopes
# These scopes must be present in the access token for any request
# Leave empty for no global scope requirements (tool-level scopes still apply)
# Example: openid profile email
# Example: read:tools write:tools
OAUTH_REQUIRED_SCOPES=

# ============================================================================
# OPTIONAL: Server Configuration
# ============================================================================

# Port - The port your server listens on
# Default: 3000
PORT=3000

# Log Level - Controls logging verbosity
# Options: debug, info, warn, error
# Default: info
LOG_LEVEL=info

# ============================================================================
# OPTIONAL: Backend Integration (Pattern 1)
# ============================================================================

# Backend API URL - Your downstream service (if using Proxyabl)
# Example: https://api.yourapp.com
# Example: http://localhost:4000
BACKEND_API_URL=

# Backend Timeout - Request timeout in milliseconds
# Default: 30000 (30 seconds)
BACKEND_TIMEOUT=30000

# ============================================================================
# OPTIONAL: Custom JWT Validation
# ============================================================================

# JWKS URI - Override automatic JWKS discovery
# Only needed if your OAuth provider doesn't support standard OIDC discovery
# Example: https://your-oauth-provider.com/.well-known/jwks.json
JWKS_URI=

# JWT Algorithm - Expected signing algorithm
# Default: RS256 (RSA with SHA-256)
# Common options: RS256, ES256, HS256
JWT_ALGORITHM=RS256

# Clock Tolerance - Allows for clock skew between servers (in seconds)
# Default: 30
JWT_CLOCK_TOLERANCE=30
```

---

## Provider-Specific Examples

### Auth0 Configuration

```bash
# Your Auth0 tenant domain
OAUTH_ISSUER=https://your-tenant.us.auth0.com/

# The API identifier you created in Auth0 Dashboard > APIs
OAUTH_AUDIENCE=https://api.yourapp.com

# Optional: Auth0 scopes
OAUTH_REQUIRED_SCOPES=openid profile email
```

**Setup Steps:**
1. Go to Auth0 Dashboard > APIs > Create API
2. Set API Identifier (use as `OAUTH_AUDIENCE`)
3. Enable RBAC and "Add Permissions in the Access Token"
4. Copy your tenant domain for `OAUTH_ISSUER`

---

### Clerk Configuration

```bash
# Your Clerk Frontend API URL (found in Clerk Dashboard)
OAUTH_ISSUER=https://your-app.clerk.accounts.dev/

# Your API audience (configure in Clerk Dashboard > JWT Templates)
OAUTH_AUDIENCE=your-api-identifier

OAUTH_REQUIRED_SCOPES=
```

**Setup Steps:**
1. Go to Clerk Dashboard > JWT Templates
2. Create a new template or use "Blank"
3. Set the `aud` claim to your API identifier
4. Use the Frontend API URL as `OAUTH_ISSUER`
5. Configure scopes in the template if needed

---

### Google OAuth Configuration

```bash
OAUTH_ISSUER=https://accounts.google.com

# Your OAuth Client ID
OAUTH_AUDIENCE=123456789-abcdefg.apps.googleusercontent.com

# Google scopes
OAUTH_REQUIRED_SCOPES=openid email profile
```

**Setup Steps:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID
3. Use the Client ID as `OAUTH_AUDIENCE`
4. Configure authorized redirect URIs for ChatGPT

---

### Okta Configuration

```bash
# Your Okta domain
OAUTH_ISSUER=https://your-org.okta.com/oauth2/default

# The audience value from your Okta API settings
OAUTH_AUDIENCE=api://default

OAUTH_REQUIRED_SCOPES=openid profile email
```

**Setup Steps:**
1. Go to Okta Admin > Security > API
2. Select your Authorization Server
3. Note the Issuer URI for `OAUTH_ISSUER`
4. Configure audience in Access Policies

---

## Understanding Key Concepts

### What is `OAUTH_ISSUER`?

The **issuer** is the OAuth/OIDC provider that creates and signs your JWT tokens. When a JWT is verified:
- The `iss` claim in the JWT must match this value exactly
- The server automatically fetches public keys from `{OAUTH_ISSUER}/.well-known/jwks.json`
- Must include the protocol (`https://`) and trailing slash if required by your provider

**Common mistake:** Forgetting the trailing slash when required (e.g., Auth0 requires it)

### What is `OAUTH_AUDIENCE`?

The **audience** identifies which API or resource server the token is meant for. This prevents token misuse:
- The `aud` claim in the JWT must match this value
- Prevents tokens issued for one API from being used on another
- Can be a URL (like `https://api.yourapp.com`) or an identifier (like `my-api`)

**Best practice:** Use a URL format for clarity, but any unique string works

### What are Scopes?

**Scopes** are permissions that define what the token holder can do:
- `OAUTH_REQUIRED_SCOPES` = global scopes required for any request
- Tool-level scopes = specific permissions needed for individual tools
- Example: `read:data write:data admin:users`

The gateway checks that the token contains the required scopes before executing tools.

---

## Troubleshooting Common Configuration Issues

### Issue: "Invalid issuer"
```
❌ Error: Token issuer does not match configured issuer
```

**Fix:** Ensure `OAUTH_ISSUER` exactly matches the `iss` claim in your JWT, including:
- Protocol (`https://`)
- Trailing slashes
- Case sensitivity

**Debug:** Decode your JWT at jwt.io and compare the `iss` claim

---

### Issue: "Invalid audience"
```
❌ Error: Token audience does not match configured audience
```

**Fix:** The `aud` claim in your JWT must match `OAUTH_AUDIENCE` exactly

**Debug:** Check your OAuth provider's API/audience configuration

---

### Issue: "Unable to fetch JWKS"
```
❌ Error: Cannot fetch public keys from issuer
```

**Fix:** 
- Ensure `OAUTH_ISSUER` is publicly accessible
- Verify `{OAUTH_ISSUER}/.well-known/jwks.json` exists
- Check firewall rules if running locally

---

### Issue: "Missing required scope"
```
❌ Error: Token does not contain required scope: read:data
```

**Fix:**
- Check token scopes in your OAuth provider configuration
- Ensure scopes are included in the access token (not just ID token)
- Verify scope names match exactly (case-sensitive)

---

## Local Development Tips

### Using Ngrok or Similar Tunnels

```bash
# Start your server
npm run dev

# In another terminal, create a tunnel
ngrok http 3000

# Update your OAuth provider's redirect URIs with the ngrok URL
# Example: https://abc123.ngrok.io/callback
```

### Testing Without ChatGPT

```bash
# Get a token from your OAuth provider's test interface
export TEST_TOKEN="your.jwt.token"

# Test the debug endpoint
curl -H "Authorization: Bearer $TEST_TOKEN" http://localhost:3000/debug-token

# Test tools/list
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use strong audience values** - Avoid generic strings like "api" or "test"
3. **Minimize scope permissions** - Only grant what each tool needs
4. **Rotate secrets regularly** - Update OAuth client secrets periodically
5. **Enable HTTPS in production** - Never use HTTP for OAuth flows
6. **Validate token expiration** - Ensure tokens have reasonable TTLs (e.g., 1 hour)

---

## Quick Start Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Set `OAUTH_ISSUER` from your provider
- [ ] Set `OAUTH_AUDIENCE` to your API identifier
- [ ] Configure OAuth provider redirect URIs
- [ ] Test with `curl http://localhost:3000/debug-token`
- [ ] Verify `.well-known/oauth-protected-resource` returns valid config
- [ ] Connect to ChatGPT and test OAuth flow