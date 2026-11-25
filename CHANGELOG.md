# SilopiDijital Veresiye — Değişiklik Günlüğü

## 0.2.9

- Supabase publishable key case-sensitivity issue fixed in Vite and Vercel server-side proxies. Stale environment overrides can no longer replace the current key.
- Added a regression test for the exact project key.
- No database migration or customer data changes.



## Cloudflare Pages deployment adapter (0.2.9 deployment package)

- Added a Cloudflare Pages Function for the same-origin health, customer-login, and admin API routes.
- The Function forwards only the two approved Edge Function names to the personal Yunus ProPOS Supabase project.
- Added bounded request bodies, a 20-second upstream timeout, upstream status/body pass-through, stable JSON 4xx/5xx responses, and Cloudflare-observed IP forwarding.
- Preserved existing Vercel routes as a fallback; no Supabase Edge Function, database schema, or customer data was changed.
- Added mocked Cloudflare route integration tests and deployment documentation.
