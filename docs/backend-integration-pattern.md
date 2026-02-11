# Backend Integration Pattern & Example

## Architecture Overview

```
┌──────────┐      ┌──────────┐      ┌──────────────┐      ┌──────────┐
│          │      │          │      │              │      │          │
│   LLM    │─────▶│ Gateway  │─────▶│   Backend    │─────▶│   Data   │
│ (Client) │      │  (MCP)   │      │     API      │      │  Store   │
│          │◀─────│          │◀─────│              │◀─────│          │
└──────────┘      └──────────┘      └──────────────┘      └──────────┘
     │                  │                   │
     │                  │                   │
   JWT Token      Verify JWT          Verify JWT
   from OAuth     + Forward           + Execute
                  Token               Business Logic
```

---

## Pattern 1: End-to-End OAuth (Recommended)

The Gateway forwards the **same OAuth token** to your backend, and both independently verify it.

**Pros:**
- True end-to-end security
- Backend has full user context
- No trust boundary between Gateway and Backend
- Works with any backend (even external APIs)

**Cons:**
- Backend must implement JWT verification
- Two verification steps (slight latency)

---

## Example Backend Implementation (Express + TypeScript)

### 1. Backend Server Setup

**backend/package.json:**
```json
{
  "name": "mcp-backend-example",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@gatewaystack/identifiabl": "^1.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
```

**backend/.env:**
```bash
# Must match Gateway configuration
OAUTH_ISSUER=https://your-oauth-provider.com/
OAUTH_AUDIENCE=your-api-identifier

PORT=4000
```

---

### 2. JWT Verification Middleware

**backend/src/middleware/auth.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '@gatewaystack/identifiabl';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    uid: string;
    email?: string;
    scopes: string[];
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT using the same OAuth config as Gateway
    const decoded = await verifyJWT(token, {
      issuer: process.env.OAUTH_ISSUER,
      audience: process.env.OAUTH_AUDIENCE
    });

    // Extract user info from token
    req.user = {
      sub: decoded.sub,
      uid: decoded.sub, // Or map to your internal user ID
      email: decoded.email,
      scopes: decoded.scope?.split(' ') || []
    };

    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Token verification failed'
    });
  }
}

// Optional: Scope checking middleware
export function requireScopes(...requiredScopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userScopes = req.user?.scopes || [];
    
    const hasAllScopes = requiredScopes.every(scope =>
      userScopes.includes(scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
        missing: requiredScopes.filter(s => !userScopes.includes(s))
      });
    }

    next();
  };
}
```

---

### 3. Backend Routes

**backend/src/routes/tasks.ts:**
```typescript
import { Router } from 'express';
import { AuthenticatedRequest, requireAuth, requireScopes } from '../middleware/auth';

const router = Router();

// Example: Get user's tasks
router.get('/tasks',
  requireAuth,
  requireScopes('read:tasks'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      
      // Fetch user-specific data from database
      const tasks = await db.tasks.findMany({
        where: { userId }
      });

      res.json({ tasks });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Example: Create a new task
router.post('/tasks',
  requireAuth,
  requireScopes('write:tasks'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      const { title, description } = req.body;

      const task = await db.tasks.create({
        data: {
          userId,
          title,
          description,
          createdAt: new Date()
        }
      });

      res.status(201).json({ task });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

// Example: Get user profile
router.get('/profile',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = await db.users.findUnique({
        where: { id: req.user!.uid }
      });

      if (!user) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

export default router;
```

---

### 4. Backend Server

**backend/src/server.ts:**
```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import taskRoutes from './routes/tasks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'mcp-backend',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', taskRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`OAuth Issuer: ${process.env.OAUTH_ISSUER}`);
  console.log(`OAuth Audience: ${process.env.OAUTH_AUDIENCE}`);
});
```

---

## Gateway Configuration for Backend Integration

**gateway/.env:**
```bash
# OAuth config (same as backend)
OAUTH_ISSUER=https://your-oauth-provider.com/
OAUTH_AUDIENCE=your-api-identifier

# Backend API URL
BACKEND_API_URL=http://localhost:4000
```

**gateway/src/tools/tools.ts:**
```typescript
import { callBackend } from '@gatewaystack/proxyabl';

export const TOOL_REGISTRY = {
  getTasks: {
    requiredScopes: ['read:tasks'],
    descriptor: {
      name: 'getTasks',
      description: 'Get the current user\'s tasks',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    handler: async (params: any, uid: string, accessToken: string) => {
      // Forward request to backend with same OAuth token
      const response = await callBackend({
        method: 'GET',
        path: '/api/tasks',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return {
        content: [{
          type: 'text',
          text: `Found ${response.tasks.length} tasks:\n` +
                response.tasks.map((t: any) => `- ${t.title}`).join('\n')
        }]
      };
    }
  },

  createTask: {
    requiredScopes: ['write:tasks'],
    descriptor: {
      name: 'createTask',
      description: 'Create a new task',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title'
          },
          description: {
            type: 'string',
            description: 'Task description'
          }
        },
        required: ['title']
      }
    },
    handler: async (params: any, uid: string, accessToken: string) => {
      const response = await callBackend({
        method: 'POST',
        path: '/api/tasks',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: params.title,
          description: params.description
        })
      });

      return {
        content: [{
          type: 'text',
          text: `Created task: ${response.task.title}`
        }]
      };
    }
  }
};
```

---

## Testing the Integration

### 1. Start Both Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Gateway
cd gateway
npm run dev
```

### 2. Test Backend Directly

```bash
# Get a test token from your OAuth provider
export TOKEN="eyJhbG..."

# Test backend auth
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/profile | jq

# Test backend endpoints
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/tasks | jq
```

### 3. Test Through Gateway

```bash
# Test via MCP protocol
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "getTasks",
      "arguments": {}
    },
    "id": 1
  }' | jq
```

### 4. Test with an MCP Client

1. Configure your MCP client (ChatGPT, Claude, etc.) with your Gateway URL
2. Complete OAuth flow
3. Ask: "What tasks do I have?"
4. The MCP client calls Gateway → Gateway calls Backend → Backend returns data

---

## Security Considerations

### ✅ Do This

1. **Always verify tokens in both Gateway and Backend**
   - Defense in depth
   - No single point of failure

2. **Use the same OAuth configuration**
   - Same issuer, audience, JWKS
   - Ensures token validity everywhere

3. **Enforce scopes at every layer**
   - Gateway checks scopes before forwarding
   - Backend checks scopes before data access

4. **Use HTTPS in production**
   - Never send tokens over HTTP
   - Use TLS 1.2 or higher

5. **Log security events**
   - Failed auth attempts
   - Scope violations
   - Suspicious patterns

### ❌ Don't Do This

1. **Don't skip backend verification**
   - Never trust the Gateway blindly
   - Always verify the token yourself

2. **Don't use different audiences**
   - Gateway and Backend should accept the same token
   - Or use multi-audience tokens

3. **Don't expose internal errors**
   - Log details server-side
   - Return generic errors to clients

4. **Don't cache tokens indefinitely**
   - Respect token expiration
   - Implement proper TTL

---

## Alternative Pattern: Trusted Gateway

If your Gateway and Backend are tightly coupled and on the same network:

```typescript
// Gateway generates a signed internal token
const internalToken = signInternalToken({
  userId: uid,
  scopes: userScopes
});

// Backend trusts Gateway's signature
const decoded = verifyInternalToken(internalToken);
```

**Use this pattern only if:**
- Gateway and Backend are in the same private network
- You want to reduce OAuth verification overhead
- You have strong network security

**This pattern is NOT recommended for:**
- Public backends
- Third-party integrations
- Multi-tenant systems

---

## Deployment Considerations

### Docker Compose Example

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      - OAUTH_ISSUER=${OAUTH_ISSUER}
      - OAUTH_AUDIENCE=${OAUTH_AUDIENCE}
      - BACKEND_API_URL=http://backend:4000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - OAUTH_ISSUER=${OAUTH_ISSUER}
      - OAUTH_AUDIENCE=${OAUTH_AUDIENCE}
      - DATABASE_URL=${DATABASE_URL}
```

### Kubernetes Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-gateway
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: gateway
        image: your-registry/mcp-gateway:latest
        env:
        - name: BACKEND_API_URL
          value: "http://mcp-backend:4000"
        - name: OAUTH_ISSUER
          valueFrom:
            secretKeyRef:
              name: oauth-config
              key: issuer
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-backend
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: backend
        image: your-registry/mcp-backend:latest
```

---

## Summary

**End-to-End OAuth Pattern:**
1. The MCP client gets an OAuth token from the provider
2. Gateway receives token, verifies it, forwards to Backend
3. Backend verifies the same token independently
4. Both services enforce scopes and user context

**Benefits:**
- Strong security (defense in depth)
- Clear separation of concerns
- Backend remains independently secure
- Works with any architecture

**Implementation Checklist:**
- [ ] Backend implements JWT verification
- [ ] Backend checks scopes on protected routes
- [ ] Gateway forwards `Authorization` header
- [ ] Both use same OAuth configuration
- [ ] Error handling at both layers
- [ ] Logging and monitoring enabled