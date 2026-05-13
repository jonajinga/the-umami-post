# Security Policy

## Scope

This policy covers responsible disclosure of security vulnerabilities in the
**source code and build infrastructure** of The Freethinking Times.

**In scope:**

- Cross-site scripting (XSS) or injection vulnerabilities in Nunjucks templates
  or client-side JavaScript
- Exposed secrets, API keys, or credentials committed to the repository
- Vulnerabilities in GitHub Actions workflows that could compromise the deploy pipeline
- Open redirects or server-side request forgery in API route templates (`src/api/`)
- Configuration errors that could expose private data

**Out of scope:**

- Denial-of-service attacks against Cloudflare infrastructure — report these to
  [Cloudflare directly](https://www.cloudflare.com/trust-hub/security-policy/)
- Spam or abuse of the contact or submission forms — email
  [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com)
- Vulnerabilities in third-party services we use (Pagefind, Decap CMS, Cusdis,
  Buttondown, Web3Forms) — report those to the respective projects
- Editorial disputes, factual errors, or harassment — see
  [CONTRIBUTING.md](CONTRIBUTING.md) for the appropriate channels

---

## Reporting a Vulnerability

**Do not open a public GitHub issue.** Public issues expose vulnerabilities to
everyone before they can be fixed.

**Email:** [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com)
with **subject line: Security Disclosure**

Include in your report:
- A description of the vulnerability and its potential impact
- Step-by-step instructions to reproduce it
- Proof of concept (screenshot, code snippet, curl command) if available
- Your name and contact information (for credit and follow-up)

We treat all reports confidentially until a fix is deployed.

---

## Response Timeline

| Step | Target |
|---|---|
| Initial acknowledgment | Within 72 hours |
| Severity assessment and fix timeline provided | Within one week |
| Fix deployed | Depends on severity — critical issues within 48 hours of confirmation |
| Reporter notified that fix is live | Within 24 hours of deployment |

---

## Coordinated Disclosure

We follow coordinated disclosure:

1. You report the vulnerability to us privately.
2. We confirm the issue, develop a fix, and deploy it.
3. We notify you when the fix is live.
4. You may publish a write-up of your findings after the fix is deployed.

We ask that you allow **30 days** from your initial report before public disclosure,
or until a fix is live — whichever comes first. For critical vulnerabilities requiring
significant remediation, we may request a short extension.

We will credit you in our public changelog for any confirmed vulnerability, unless
you prefer to remain anonymous.

---

## No Bug Bounty

We are an independent, reader-supported publication. We do not have a bug bounty
program. We offer genuine thanks and public credit.

---

## Supported Versions

Only the current deployment on the `main` branch is supported. We do not maintain
versioned releases of the site code.
