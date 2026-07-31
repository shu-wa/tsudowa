# TSUDOWA Security Policy

## Supported version

TSUDOWA is currently in pre-release. Security fixes are applied to the latest version on the `main` branch and to the latest store build only.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to `support@tsudowa.app`. Do not include passwords, access tokens, private event content, or other users' personal information. Please do not open a public GitHub issue until a fix is available.

Useful details include the affected screen or API, reproduction steps, expected and actual behavior, app version, OS version, and the minimum evidence needed to confirm impact. Avoid accessing, changing, or deleting data that does not belong to you.

## Security design

- Supabase Auth verifies identity; privileged server credentials are never bundled in the app.
- PostgreSQL Row Level Security and checked RPCs enforce event membership and host/cohost permissions even when a client bypasses the UI.
- Event ownership, host roles, membership state, consent evidence, reports, and messages cannot be rewritten through unrestricted table updates.
- Invite tokens are random, stored as one-way hashes, expire, have usage limits, and are rate limited.
- Chat and app images use private buckets, exact path rules, MIME/size limits, uploader quotas, and short-lived signed URLs.
- Sensitive account export and deletion require recent password authentication and return non-cacheable responses.
- Native authentication sessions and compact account state are stored with iOS Keychain or Android Keystore through Expo SecureStore. Cloud event and chat data are not persisted as a plaintext device cache.
- Authentication callbacks use PKCE and accept authorization codes only on allowlisted TSUDOWA routes.
- Server-side rate limits reduce event, invite, message, report, and storage abuse.

No software can guarantee that attacks are impossible. These controls reduce the effect of a compromised client, but production security also depends on prompt dependency updates, protected operator accounts, monitoring, backups, and a tested incident-response process.

## Operator requirements

- Require phishing-resistant MFA or, at minimum, TOTP MFA for Supabase, GitHub, Expo, Cloudflare, Apple, Google Cloud, and store-console accounts.
- Keep recovery codes offline and never share passwords, one-time codes, service-role keys, signing keys, or EAS credentials.
- Review Supabase Auth and database security advisories before each release.
- Rotate a credential immediately if it may have been exposed, review audit logs, invalidate affected sessions, and notify affected users when required.
- Test authorization with separate host, cohost, member, and unrelated-user accounts before store submission.
