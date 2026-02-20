# Technical Architecture

## 1) Components

### Infrastructure
- Linode VM (Ubuntu 24.04)
- Linode cloud firewall (ingress: 22/80/443)

### Host users
- `keith`: interactive admin user (SSH + sudo)
- `deploy`: non-login user for stack ownership and Docker/Compose runtime

### Runtime services
- Traefik v3 (edge router, TLS, security headers, edge rate limiting)
- PostgreSQL 16 (internal network only)
- Watchtower (auto-pulls new images from Docker Hub)
- keithwilliams.org blog (Next.js, from Docker Hub)

### Application stack (keithwilliams.org)
- Next.js App Router (standalone output)
- Auth.js v5 / `next-auth` beta with Google OAuth
- PostgreSQL database sessions via `@auth/pg-adapter`
- Role-based access (`admin` / `user`)
- Comments
- Honeypot anti-spam and app-level rate limiting

## 2) Directory layout on host

- `/srv/stacks/traefik`
- `/srv/stacks/postgres`
- `/srv/stacks/watchtower`
- `/srv/stacks/apps/<appname>`
- `/etc/stack/secrets`
- `/srv/backups/postgres`
- `/srv/reports/{lynis,trivy,health}`

## 3) Docker networks

- `traefik_proxy` (external): Traefik ↔ app traffic
- `backend_internal` (external): app ↔ Postgres traffic

Postgres attaches only to `backend_internal` and does not publish host ports.

## 4) Request flow

1. Client resolves domain to Linode public IP.
2. Request reaches Traefik on port 80 or 443.
3. Port 80 is redirected to HTTPS.
4. Traefik matches Host rules from Docker labels.
5. Traefik applies middleware chain (rate-limit → compress → secure-headers).
6. Traefik forwards to the Next.js container on the internal Docker network.

## 5) TLS flow

- Let's Encrypt HTTP-01 challenge handled by Traefik
- Cert metadata/state persisted in `acme.json`
- Renewal managed by Traefik automation

## 6) Data flow

- App services connect to Postgres via the `backend_internal` network
- Nightly backups run via `pg_dump`, producing `.sql.gz` artifacts
- Restore uses `psql` with a decompressed dump piped to stdin

## 7) Build and deployment model

- Infra lifecycle: Terraform `init/plan/apply/destroy`
- Config/deploy lifecycle: Ansible playbook idempotent re-run
- App lifecycle:
	- Push to app repo `main`
	- GitHub Actions builds/pushes Docker Hub image
	- Watchtower pulls `:latest` and replaces the running container

## 8) Security controls (high level)

Host:
- Cloud firewall + UFW (defense in depth)
- fail2ban for SSH abuse mitigation
- SSH hardening via drop-in config

Edge:
- Security headers and CSP enforced via Traefik middleware
- Edge rate limiting via Traefik

Application:
- Google OAuth only (no password storage)
- Server-side RBAC checks for all mutating actions
- Honeypot + timing check
- App-level rate limiting
- Input validation and sanitization

Secrets:
- Stored on host in `/etc/stack/secrets` with strict permissions

## 9) Operational observability

Current:
- Container logs (`docker logs <container>`)
- Host security reports (Lynis, Trivy)
- Healthcheck failure log

Recommended future enhancement:
- Metrics and centralized logging

## 10) Failure domains

Single-node risk profile:
- VM outage impacts all hosted domains and DB
- Disk corruption risks local backup strategy

Mitigation path:
- Offsite backup sync
- Warm standby or multi-node migration plan
