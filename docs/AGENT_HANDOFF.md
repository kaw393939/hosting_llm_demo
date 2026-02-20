# Agent Handoff — keithwilliams.org

This document is a handoff for a new coding agent to develop and maintain **keithwilliams.org** and its infrastructure.

Date: 2026-02-19

## 1) Repos and where they live

You are working with two separate repos:

1) **Infrastructure repo (this workspace)**
- Path: `/Users/kwilliams/Projects/keithwilliams.org`
- Purpose: provisioning + hardening + stack deployment + runbooks

2) **App repo (Next.js blog)**
- Path: `/Users/kwilliams/Projects/kethwilliams.org-site`
- Purpose: Next.js application code (Auth.js, RBAC, comments, anti-abuse)
- Built/pushed as Docker image to Docker Hub: `kaw393939/keithwilliams.org:latest`

## 2) Production topology (single server)

- VM: Linode Ubuntu 24.04
- Edge: Traefik v3 (ports 80/443)
- DB: Postgres 16 on internal Docker network only
- App: Next.js blog container listening on port 3000 (not published to host)
- Auto deploy: Watchtower pulls `:latest` when CI pushes a new image

Docker networks:
- `traefik_proxy`: Traefik ↔ app
- `backend_internal`: app ↔ Postgres

## 3) Deployment model (how changes reach production)

### App deploy

1. Developer pushes to app repo `main`
2. GitHub Actions builds and pushes Docker image to Docker Hub (`latest` + SHA)
3. Watchtower on the server pulls the new image and restarts the container

The app container entrypoint runs:

1) `node scripts/migrate.mjs` (file-based SQL migrations)
2) `node server.js` (Next.js standalone server)

### Infra deploy

Infra changes are applied by re-running the Ansible playbook in this repo:
- Path: `bootstrap/ansible/playbook.yml`

## 4) keithwilliams.org app behavior

### Auth
- Auth.js v5 / `next-auth` beta, Google OAuth
- DB-backed sessions (Postgres)

### Roles
- `admin` and `user`
- First signed-in user is auto-promoted to `admin`
- Admin-only: create posts, access `/admin`, manage roles, delete posts/comments
- Authenticated users: can comment
- Guests: read-only

### Admin UI
- `/admin` is a server-rendered admin dashboard for:
  - user role changes
  - deleting posts
  - deleting comments

### Anti-abuse
- Honeypot + timing check on forms
- Application-level rate limiting (in-memory sliding window)
- Traefik edge rate limiting (30 req/s avg, 60 burst)

### API
- `/api/posts` supports GET only; all other methods return 405

## 5) Security headers / edge controls

Traefik applies:
- HSTS (preload)
- CSP (no `unsafe-eval`; `unsafe-inline` allowed for Next.js)
- X-Frame-Options deny
- nosniff
- XSS filter
- Referrer-Policy strict-origin-when-cross-origin
- Permissions-Policy denying sensors
- X-Robots-Tag `noai, noimageai`

## 6) Break-glass admin recovery

If nobody can access `/admin` but you need to promote a user:

Option A (recommended): run the app’s CLI inside the app container:

```bash
sudo -u deploy docker exec -i keithwilliams_blog node scripts/admin.mjs list-users
sudo -u deploy docker exec -i keithwilliams_blog node scripts/admin.mjs promote --email <email>
```

Option B: update the DB directly:

```bash
sudo -u deploy docker exec -i postgres sh -lc 'PGPASSWORD="$(cat /run/secrets/postgres_password)" psql -U app -d app -c "UPDATE users SET role='\''admin'\'' WHERE lower(email)=lower('\''you@example.com'\'');"'
```

After role changes: user must sign out/in (session refresh) to see new capabilities.

## 7) Secrets and configuration (important)

### Do not commit secrets

This repo previously had real secrets appear in local files. Treat any exposed tokens as compromised and rotate them.

### How Ansible gets secrets now

- Non-secret defaults live in: `bootstrap/ansible/group_vars/all.yml` (no real secrets)
- Local-only secrets file:
  - Example: `bootstrap/ansible/group_vars/all.secrets.yml.example`
  - Real file: `bootstrap/ansible/group_vars/all.secrets.yml` (gitignored)

Inventory:
- Example: `bootstrap/ansible/inventories/hosts.ini.example`
- Real: `bootstrap/ansible/inventories/hosts.ini` (gitignored)

Host secrets path:
- `/etc/stack/secrets` (root-owned)

## 8) Database schema/migrations

The app’s schema is initialized/migrated by `scripts/migrate.mjs` applying `migrations/*.sql`.

Important gotchas:
- `CREATE TABLE IF NOT EXISTS` does NOT add missing columns.
- When adding columns, use idempotent `ALTER TABLE` blocks.
- Never edit previously-applied migration files: the runner stores a sha256 checksum and will refuse to continue if a file changes.

## 9) Operational checks

Quick smoke checks:

```bash
curl -sSI https://keithwilliams.org/ | head -n 15
curl -sSI https://keithwilliams.org/new | head -n 5
curl -sSI https://keithwilliams.org/admin | head -n 5
curl -sS -X POST https://keithwilliams.org/api/posts
```

On-host (requires SSH):

```bash
sudo -u deploy docker ps
sudo -u deploy docker logs --tail 200 traefik
sudo -u deploy docker logs --tail 200 keithwilliams_blog
sudo -u deploy docker logs --tail 200 postgres
```

## 10) Known issues / improvements

1) Lighthouse
- Desktop scores reached 100/95/100/100 at one point; one contrast issue was identified and a fix prepared.
- After deploying the latest app image, re-run Lighthouse to confirm Accessibility is back to 100.

2) Rate limiting durability
- App-level limiter is in-memory: restarts reset counters; multiple instances would not share state.
- If abuse becomes a problem, consider moving to Redis-backed rate limits.

3) Backups
- Backups are currently local-only. The next reliability win is offsite backup sync.

4) Monitoring/alerting
- Add uptime monitoring + alerting (Uptime Kuma or equivalent) so you notice outages fast.
