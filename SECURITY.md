# Security Policy

ThreatForge is a security tool, and we take the security of the project itself
seriously.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately:

- **Email:** security@bpmforge.com
- **Subject:** `ThreatForge security report`
- Preferred: use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  on this repository ("Security" tab → "Report a vulnerability").

Please include:

- A description of the issue and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Affected version / commit.
- Any suggested remediation.

## What to Expect

- **Acknowledgement** within 5 business days.
- An initial assessment and severity rating shortly after.
- Coordinated disclosure: we will agree on a disclosure timeline with you and
  credit you (if you wish) once a fix is released.

## Supported Versions

Security fixes are applied to the latest released version. Older versions may
not receive backported fixes.

## Scope

In scope: the ThreatForge application code in this repository (frontend,
server, deployment manifests).

Out of scope: the hosted demo environment infrastructure, third-party
dependencies (report those upstream), and findings that require physical access
or a compromised host.
