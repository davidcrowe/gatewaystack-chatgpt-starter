# Extended Troubleshooting Guide

## Debugging OAuth & MCP Issues

---

## 🔴 401 Errors

### Problem: `401 Unauthorized - Invalid token`

**Symptoms:**
- MCP client keeps prompting for login
- `tools/list` returns 401
- Error: "JWT verification failed"

**Root Causes & Solutions:**

#### 1. Issuer/Audience Mismatch

```bash
# Decode your JWT to inspect claims
# Visit https://jwt.io and paste your token

# Common issues:
❌ OAUTH_ISSUER=https://auth.example.com    # Missing trailing slash
✅ OAUTH_ISSUER=https://auth.example.com/   # Correct

❌ OAUTH_AUDIENCE=https://api.example.com/  # Extra trailing slash
✅ OAUTH_AUDIENCE=https://api.example.com   # Correct
```

**Debug command:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/debug-token | jq
```

Expected output:
```json
{
  "valid": true,
  "sub": "user123",
  "aud": "https://api.example.com",
  "scope": "read:data write:data"
}
```

#### 2. JWKS Not Reachable

```bash
# Test JWKS endpoint accessibility
curl https://your-issuer.com/.well-known/jwks.json

# If this fails, check:
# - Is your OAUTH_ISSUER URL correct?
# - Is it publicly accessible?
# - Are you behind a firewall?
```

**Fix for local development:**
```bash
# Use ngrok or similar to expose your OAuth provider
ngrok http 9000  # if your auth server is on port 9000
```

#### 3. Token Expired

```bash
# Check token expiration
# Decode JWT at jwt.io and look at "exp" claim
# exp=1234567890 is a Unix timestamp

# Typical TTL issues:
# - Token expired (common with 1-hour TTL)
# - Clock skew between servers
```

**Fix:**
```bash
# Adjust clock tolerance in .env
JWT_CLOCK_TOLERANCE=60  # Allow 60 seconds of clock skew
```

---

### Problem: `401 - Missing required scope`

**Symptoms:**
- OAuth succeeds but tool calls fail
- Error: "Token does not contain required scope: X"

**Solutions:**

#### Check Token Scopes
```bash
# Decode your token and look at the "scope" claim
# Should be a space-separated string: "read:data write:data"

# Common mistakes:
❌ "scope": ["read:data", "write:data"]  # Array format (some providers)
✅ "scope": "read:data write:data"       # Space-separated string
```

#### Configure Provider to Include Scopes

**Auth0:**
```
Dashboard > APIs > Your API > Settings
✅ Enable "Add Permissions in the Access Token"
```

**Clerk:**
```
Dashboard > JWT Templates > Your Template
Add to claims:
{
  "scope": "{{user.publicMetadata.scopes}}"
}
```

**Okta:**
```
Security > API > Authorization Servers > Access Policies
Ensure scope claim is included in token
```

#### Tool-Level vs Global Scopes

```typescript
// In src/tools/tools.ts
export const TOOL_REGISTRY = {
  myTool: {
    requiredScopes: ['read:data'],  // Tool-specific
    // ...
  }
};

// In .env
OAUTH_REQUIRED_SCOPES=openid profile  // Global (all requests)
```

---

## 🔴 MCP Client Integration Issues

### Problem: MCP Client Keeps Prompting OAuth

**Symptoms:**
- Login succeeds but the MCP client prompts again immediately
- `WWW-Authenticate` header not recognized

**Solutions:**

#### 1. Verify Well-Known Endpoints

```bash
# These must return valid JSON
curl http://localhost:3000/.well-known/oauth-protected-resource
curl http://localhost:3000/.well-known/openid-configuration

# Expected structure:
{
  "resource": "https://your-api.com",
  "authorization_servers": ["https://your-auth.com"]
}
```

#### 2. Check WWW-Authenticate Header Format

```bash
# When 401 is returned, inspect headers
curl -i -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Should include:
WWW-Authenticate: Bearer realm="mcp", 
  authorization_uri="https://auth.example.com/authorize",
  token_uri="https://auth.example.com/token"
```

**Fix in code:**
```typescript
// src/handlers/authHelpers.ts
function buildWwwAuthenticate() {
  return `Bearer realm="mcp", ` +
    `authorization_uri="${OAUTH_ISSUER}authorize", ` +
    `token_uri="${OAUTH_ISSUER}token"`;
}
```

#### 3. Verify OAuth Provider Configuration

MCP clients require:
- ✅ Authorization endpoint (`/authorize`)
- ✅ Token endpoint (`/token`)
- ✅ Redirect URI configured for your MCP client
- ✅ Client credentials (the MCP client's client ID)

---

### Problem: `ACCESS_TOKEN_IS_ENCRYPTED_JWE`

**Symptoms:**
- Error message mentions JWE (JSON Web Encryption)
- Token looks like: `eyJhbG...` but has 5 parts instead of 3

**Cause:**
Your OAuth provider is returning encrypted tokens (JWE) instead of signed tokens (JWS/JWT).

**Solutions:**

#### Auth0:
```
Dashboard > Applications > Your App > Settings
Advanced Settings > OAuth > JsonWebToken Signature Algorithm
✅ Select RS256 (not HS256 with encryption)
```

#### Clerk:
```
Dashboard > JWT Templates > Your Template
⚠️  Clerk always returns JWTs (not JWE) - check you're using the access token, not ID token
```

#### General:
- Access tokens must be JWS (3-part JWT: header.payload.signature)
- ID tokens may be encrypted (JWE) but shouldn't be used for API auth
- If your provider only supports JWE, you'll need to decrypt before validation

---

## 🔴 Tool Execution Errors

### Problem: Tool Call Returns 500

**Symptoms:**
- `tools/list` works but `tools/call` fails
- Server logs show internal error

**Debug Steps:**

#### 1. Check Server Logs
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Look for stack traces that show:
# - Missing environment variables
# - Backend connection failures
# - Unhandled promise rejections
```

#### 2. Test Tool Execution Directly

```bash
# Bypass MCP protocol and test the tool function
node -e "
const { executeTool } = require('./src/tools/tools');
executeTool('myTool', { param: 'value' }, 'user123')
  .then(console.log)
  .catch(console.error);
"
```

#### 3. Verify Backend Integration (if using Proxyabl)

```bash
# Test backend endpoint directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend.com/api/endpoint

# Common issues:
# - Backend not running
# - BACKEND_API_URL misconfigured
# - CORS issues
# - Backend rejecting forwarded token
```

---

### Problem: Tool Returns Empty or Incorrect Results

**Symptoms:**
- Tool executes without error
- Returns null, undefined, or wrong data
- User context seems missing

**Solutions:**

#### 1. Verify User Mapping

```typescript
// src/handlers/authHelpers.ts
export function subjectToUid(sub: string, email?: string): string {
  // Debug: Log the mapping
  console.log('Mapping sub to uid:', { sub, email });
  
  // Ensure this returns your internal user ID
  return lookupUserInDatabase(sub) ?? sub;
}
```

#### 2. Check Tool Parameter Validation

```typescript
// src/tools/tools.ts
export const TOOL_REGISTRY = {
  myTool: {
    handler: async (params, uid) => {
      // Debug: Verify parameters
      console.log('Tool called with:', { params, uid });
      
      // Validate required params
      if (!params.requiredField) {
        throw new Error('Missing required parameter: requiredField');
      }
      
      // ...
    }
  }
};
```

#### 3. Inspect MCP Protocol Flow

```bash
# The MCP client sends:
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "myTool",
    "arguments": {
      "param1": "value1"
    }
  },
  "id": 2
}

# Your server should return:
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool result here"
      }
    ]
  },
  "id": 2
}
```

---

## 🔴 Backend Integration Issues

### Problem: Backend Returns 401 When Token Forwarded

**Symptoms:**
- Gateway verifies token successfully
- Backend rejects the same token

**Causes:**

#### 1. Backend Audience Mismatch

```bash
# Gateway uses:
OAUTH_AUDIENCE=https://gateway.example.com

# Backend expects:
OAUTH_AUDIENCE=https://backend.example.com

# Solution: Use the same audience OR
# Issue tokens with multiple audiences
```

**Multi-audience JWT:**
```json
{
  "aud": [
    "https://gateway.example.com",
    "https://backend.example.com"
  ]
}
```

#### 2. Backend Cannot Reach JWKS

```bash
# Backend tries to fetch:
https://auth.example.com/.well-known/jwks.json

# But it's behind a firewall or VPN

# Solution: Ensure backend can reach OAuth provider
# Or cache/share JWKS between services
```

#### 3. Clock Skew

```bash
# Gateway and backend have different system times
# Token appears expired to one but not the other

# Solution: Sync NTP on both servers
# Or increase JWT_CLOCK_TOLERANCE
```

---

## 🔴 Development Environment Issues

### Problem: Cannot Test Without an MCP Client

**Solution: Simulate OAuth Flow Locally**

```bash
# 1. Get a token from your OAuth provider's test tool
# Auth0: Dashboard > APIs > Your API > Test
# Clerk: Dashboard > JWT Templates > Test
# Okta: Token previewer in Admin Console

# 2. Save to environment variable
export TEST_TOKEN="eyJhbG..."

# 3. Test endpoints
./test-local.sh
```

**test-local.sh:**
```bash
#!/bin/bash

echo "Testing debug-token..."
curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  http://localhost:3000/debug-token | jq

echo -e "\nTesting tools/list..."
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq

echo -e "\nTesting tools/call (whoami)..."
curl -s -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"whoami","arguments":{}},
    "id":2
  }' | jq
```

---

## 📊 Debugging Checklist

Use this checklist to systematically debug issues:

**OAuth Configuration:**
- [ ] `OAUTH_ISSUER` exactly matches JWT `iss` claim (including trailing slash)
- [ ] `OAUTH_AUDIENCE` exactly matches JWT `aud` claim
- [ ] JWKS endpoint is publicly accessible: `{OAUTH_ISSUER}/.well-known/jwks.json`
- [ ] OAuth provider configured with correct redirect URIs
- [ ] Token is JWS (3 parts), not JWE (5 parts)

**Scope Configuration:**
- [ ] Required scopes defined in tool registry
- [ ] Token contains all required scopes (check with jwt.io)
- [ ] Scope format is space-separated string, not array
- [ ] OAuth provider configured to include scopes in access token

**Server Configuration:**
- [ ] Server running and accessible
- [ ] Well-known endpoints return valid JSON
- [ ] `WWW-Authenticate` header present in 401 responses
- [ ] Logs show request/response flow (set `LOG_LEVEL=debug`)

**Tool Integration:**
- [ ] User mapping (`subjectToUid`) returns correct internal user ID
- [ ] Tool handlers properly validate parameters
- [ ] MCP response format matches protocol spec
- [ ] Backend (if used) accepts forwarded tokens

**Environment:**
- [ ] `.env` file exists and loaded
- [ ] No missing required environment variables
- [ ] Firewall rules allow OAuth provider access
- [ ] System clocks synchronized (for JWT exp validation)

---

## 🆘 Still Stuck?

1. **Enable debug logging:** `LOG_LEVEL=debug`
2. **Decode your JWT:** https://jwt.io
3. **Test each endpoint individually:** Use curl commands above
4. **Check OAuth provider docs:** Each provider has quirks
5. **Review server logs:** Look for stack traces and error details

Common log messages and what they mean:

| Log Message | Meaning | Fix |
|------------|---------|-----|
| `JWT verification failed: invalid issuer` | Issuer mismatch | Check `OAUTH_ISSUER` vs token `iss` |
| `JWT verification failed: invalid audience` | Audience mismatch | Check `OAUTH_AUDIENCE` vs token `aud` |
| `Token does not contain required scope` | Missing scope | Configure OAuth provider |
| `Unable to fetch JWKS` | Can't reach auth server | Check network/firewall |
| `Token expired` | Stale token | Get fresh token or adjust clock tolerance |
| `Tool not found` | Unknown tool name | Check tool registry |
| `Unauthorized - no token provided` | Missing Bearer header | Include `Authorization: Bearer ...` |