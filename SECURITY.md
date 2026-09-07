# Security

Do not open issues that include tokens, `.env.local`, or call recordings of real people.

Report vulnerabilities privately via GitHub Security Advisories on [Capveon/open-hubspot-copilot](https://github.com/Capveon/open-hubspot-copilot/security/advisories/new).

PSTN is off unless `OHC_ALLOW_PSTN=true`. Treat Twilio and HubSpot tokens as production secrets. Health (`/api/health`) is public on purpose; it must not return secrets.
