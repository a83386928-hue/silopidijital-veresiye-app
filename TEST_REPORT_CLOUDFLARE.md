# Cloudflare Pages API test report — Silopi Dijital Veresiye 0.2.9

## Verified in this preparation environment

- Cloudflare Pages route file parses with Node.js `--check`.
- Cloudflare Function integration test passed. The test covers:
  - `GET /api/veresiye/health` and the expected empty-code 401 health contract.
  - Login and admin route forwarding to the exact personal Yunus ProPOS Supabase project.
  - Exact current Supabase publishable key.
  - Upstream status and JSON body pass-through (including business-level 401).
  - Cloudflare edge client IP forwarding; browser-supplied IP headers are ignored.
  - `no-store` cache policy.
  - Allow-list rejection, method rejection, OPTIONS, malformed JSON, non-object JSON, content-type and body-size validation.
  - Network/upstream failures returned as a deterministic JSON 502 instead of an HTML error page.
- Existing regression scripts passed: security checks, Edge Function/auth contract, Vercel proxy tests, Vite dev proxy tests, PWA/brand tests, login guidance, remembered-session and token-crypto tests, publishable-key test.
- `scripts/check-security.mjs` verifies that the Cloudflare proxy targets only `ukfeuojhigxxxlnhsmls.supabase.co`, contains only the publishable key, and never contains service-role/secret keys.
- Current Supabase deployment status was read-only checked: `veresiye-portal-login` v6 ACTIVE; `veresiye-portal-admin` v3 ACTIVE.

All API route tests use a mocked Supabase upstream. No actual customer code or customer records were used or changed.

## Not verified here

- Full `npm run check` could not complete because the local package cache did not contain complete dependency/type packages. The `node_modules` placeholders available in this environment were incomplete. This is not a reported application typecheck or production-build pass.
- The real Supabase health POST could not be completed from this environment because DNS resolution for `ukfeuojhigxxxlnhsmls.supabase.co` was unavailable. The deployed `/api/veresiye/health` endpoint must be checked after Cloudflare Pages is connected.
- Wrangler/Cloudflare Pages runtime was not installed in this environment, so the real Pages runtime routing needs its first deployment verification.

Cloudflare Pages build command is intentionally set to `npm run check` so the hosted build runs typecheck, lint, mocked API tests, and production build before deployment.

## Existing public-launch security blocker

The existing Supabase project has anonymous Data API permissions on some ProPOS tables used by the desktop app. The portal UI does not query those tables directly, but the shared project's current permissions need a separate security hardening plan before exposing the portal to all customers. This package does not alter those permissions or the ProPOS desktop application; do not distribute customer QR codes publicly until that blocker is addressed.
