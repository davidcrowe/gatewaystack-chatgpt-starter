# Implementation Services

Building production-ready LLM integrations with user-scoped access requires expertise in OAuth, MCP, identity mapping, and enterprise security patterns.

If you need help implementing this for your organization, **[reducibl](https://reducibl.com)** offers implementation services for teams building AI tools on ChatGPT, Claude, and other LLM platforms.

## What We Do

> This repo is fully open source and free. We offer implementation 
> services for teams that want expert help, but everything you need 
> to self-implement is in the documentation.

We help you take your internal tools and data and make them available to your employees in ChatGPT, Claude, and other LLM platforms — with proper user authentication, authorization, and audit trails.

**Typical engagements include:**

- **MCP server implementation** — Deploy OAuth-protected MCP servers that connect your tools to LLM platforms
- **Identity & SSO integration** — Connect your existing IdP (Okta, Auth0, Azure AD) to LLM workflows
- **Backend integration patterns** — Design and implement secure user-scoped data access
- **Security & compliance review** — Audit trail implementation, scope design, policy enforcement
- **Team training** — Workshops on MCP, OAuth, and AI security patterns

## Who We Work With

- **Enterprise IT teams** adopting ChatGPT Enterprise
- **Internal AI platform teams** building custom tools
- **SaaS companies** adding LLM integrations
- **Security/compliance teams** requiring audit and governance

## Common Scenarios

### Scenario 1: Connect Internal Tools to ChatGPT Enterprise
**Challenge:** Employees want to use ChatGPT to query Salesforce, JIRA, internal databases, but you need user-level permissions.

**What we deliver:** OAuth-protected MCP servers that enforce per-user access controls and log all AI interactions.

**Timeline:** 2-4 weeks

---

### Scenario 2: Multi-Tenant SaaS with LLM Access
**Challenge:** You have a multi-tenant app and want customers to access their data through an LLM, but you can't have users seeing each other's data.

**What we deliver:** End-to-end OAuth implementation with user→tenant mapping, scope enforcement, and secure data filtering.

**Timeline:** 3-6 weeks

---

### Scenario 3: Security & Compliance for AI Tools
**Challenge:** Your security team requires audit logs, role-based access control, and proof that AI can't leak sensitive data.

**What we deliver:** Identity-aware architecture with structured logging, scope-based authorization, and compliance documentation.

**Timeline:** 2-3 weeks

---

## What You Get

✅ **Production-ready code** — Fork this repo, adapted for your tools and IdP  
✅ **Security review** — OAuth configuration, scope design, token verification  
✅ **Identity mapping** — Connect your existing user system to LLM platforms
✅ **Documentation** — Runbooks, architecture diagrams, troubleshooting guides  
✅ **Knowledge transfer** — Workshops and pairing sessions with your team  

## What You Need

We work best with teams that have:
- ChatGPT Enterprise, Claude, or similar LLM platform (or planning to adopt one)
- An existing OAuth 2.0 / OIDC identity provider (Auth0, Okta, Azure AD, etc.)
- Internal tools or data you want to make available via LLM
- Basic Node.js / TypeScript capabilities on your team

## Pricing

**Quick Start Package** — $8,500  
Get one MCP server deployed with OAuth in 2 weeks  
*Includes: OAuth setup, one tool integration, security review, documentation*

**Enterprise Package** — $25,000+  
Multiple tools, custom backend integration, team training, ongoing support  
*Includes: Everything in Quick Start + multi-tool deployment, identity mapping, compliance docs, 2-week post-launch support*

**Retainer** — $15,000/month  
Ongoing development and support for your LLM integration
*Includes: Feature development, tool additions, security updates, architecture consulting*

Custom scopes available. Contact us to discuss your specific needs.

## Process

1. **Discovery call** (30 min) — Understand your use case, tools, and constraints
2. **Scope & timeline** (1 week) — Detailed proposal with deliverables and milestones
3. **Implementation** (2-6 weeks) — Build, test, and deploy your MCP servers
4. **Handoff & training** (1 week) — Documentation, runbooks, and team workshop
5. **Post-launch support** (optional) — Ongoing maintenance and feature development

## Get Started

🌐 **Learn more:** [https://reducibl.com](https://reducibl.com)

---

## FAQ

**Q: Do you only work with ChatGPT Enterprise?**  
A: No, we work with ChatGPT Plus, Claude, and other LLM platforms that support MCP or similar protocols.

**Q: What if we don't have ChatGPT Enterprise yet?**  
A: We can help you evaluate it and design the architecture before you commit. Many clients start with a proof-of-concept on ChatGPT Plus.

**Q: Can you integrate with our existing IdP?**  
A: Yes. We work with Auth0, Okta, Azure AD, Google Workspace, and any OAuth 2.0 / OIDC provider.

**Q: What if we need custom tool development?**  
A: We handle end-to-end implementation including custom tool logic, backend APIs, and data integrations.

**Q: Do you provide ongoing support?**  
A: Yes, through retainer agreements or on-demand consulting.

**Q: What technologies do you use?**  
A: This starter repo (TypeScript/Node.js) is our default, but we adapt to your stack (Python, Go, etc.) if needed.

---

**Ready to make your tools available to LLMs?** [Get in touch →](https://reducibl.com)