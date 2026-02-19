# Next.js hosting performance tuning (platform-focused)

This guide focuses on platform-level settings and Next.js deployment patterns that consistently improve Lighthouse scores and real user experience.

## 1) Recommended Next.js deployment pattern

- Use `output: 'standalone'` so the container only ships the minimal server runtime.
- Run a multi-stage build Dockerfile.
- Run as non-root.
- Put Traefik in front for TLS and gzip.

Template:
- `stacks/apps/_templates/nextjs/`

## 2) Traefik settings that matter

Already implemented for this platform:
- HTTP -> HTTPS redirect
- Let’s Encrypt
- `exposedByDefault=false`

Recommended per-app middlewares:
- gzip compression (`compress` middleware)
- security headers middleware (already used by the sample site)

## 3) Next.js app-level settings that matter

Common improvements:
- Use `next/image` for images (correct sizing + modern formats).
- Use `next/font` to avoid layout shift and reduce render blocking.
- Avoid blocking third-party scripts; defer/async when possible.
- Prefer Server Components and partial hydration where applicable.

## 4) Static caching expectations

- Next.js typically sets long-lived caching for `/_next/static/*` assets.
- If you add custom proxies or CDNs later, preserve those cache headers.

## 5) Node runtime considerations

- Keep memory stable on small servers (2GB):
  - avoid huge build steps on the server
  - build locally or in CI and deploy images

## 6) Operational performance checks

- Use Lighthouse as a regression test after changes.
- Use `curl -I https://<domain>` to confirm:
  - HTTP status
  - `strict-transport-security`
  - compression (check `content-encoding: gzip` when applicable)

## 7) What we deliberately do not optimize yet

- HTTP/3/QUIC (nice-to-have)
- CDN edge caching
- multi-node scaling

Those are good future steps once you have multiple high-value sites.
