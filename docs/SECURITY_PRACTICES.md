# Security Practices (Owner's Reference)

This document is the authoritative description of the security posture implemented by this repo’s infrastructure + Ansible bootstrap + Docker stacks.

It is written to be used as an owner/operator checklist and as a reference for explaining your posture to clients.

## Scope and threat model (practical)

Scope:
- One Ubuntu 24.04 Linode VM
- Traefik edge router (ports 80/443)
- SSH administration (port 22)
- Docker Compose workloads (Traefik, Postgres, Watchtower, app stack)
- keithwilliams.org Next.js blog with Google OAuth (Auth.js v5)

Primary threats addressed:
- Internet scanning and opportunistic exploitation of exposed services
- Credential stuffing / brute force against SSH
- Misconfiguration (accidentally publishing databases or admin UIs)
- Secret leakage (tokens/passwords in git or world-readable files)
- Container escape risk amplification (privileged containers, Docker group access)
- Spam / abuse of forms (post creation, comments)
- Unauthorized posting or administrative access
- XSS / injection attempts against user content

Non-goals (not implemented yet):
- High availability / multi-region failover
- Full SIEM / centralized log aggregation
- Compliance frameworks (SOC2/HIPAA) beyond baseline hardening

## 1) Identity & access management

### SSH authentication
- Key-based SSH only.
- Root SSH login disabled (effective `permitrootlogin no`).
- Password authentication disabled (effective `passwordauthentication no`).

### SSH exposure reduction
- `deploy` account is *not* a remote login target.
  - SSH policy denies `deploy` explicitly (`DenyUsers deploy`).
  - The `deploy` shell is set to `/usr/sbin/nologin`.

### SSH lateral movement controls
Applied via `/etc/ssh/sshd_config.d/99-hardening.conf`:
- `AllowTcpForwarding no`
- `AllowAgentForwarding no`
- `X11Forwarding no`
- `MaxAuthTries 3`
- `MaxSessions 2`
- `LoginGraceTime 30`
- `LogLevel VERBOSE`
- Keepalive tuning: `ClientAliveInterval 300`, `ClientAliveCountMax 2`

### Local privilege model
Users:
- `keith`: interactive admin for SSH and sudo.
- `deploy`: non-login user for stack ownership and Docker/Compose operations.

Important note:
- `keith` currently has broad sudo rights (`NOPASSWD: ALL`). This is convenient, but it is a high-impact trust boundary: compromise of `keith` becomes full host compromise.
- A recommended next change is to replace broad sudo with a “break-glass” workflow (documented in the roadmap).

### Application authentication (keithwilliams.org)
- Google OAuth only via Auth.js v5 (no passwords stored)
- Database-backed sessions (can be revoked server-side)

### Application authorization (RBAC)
- Roles: `admin` and `user`
- First user to sign in is promoted to `admin` automatically
- Mutations are protected server-side:
  - Create post: admin only
  - Admin dashboard: admin only
  - Change roles / delete post / delete any comment: admin only
  - Create comment: authenticated users

## 2) Network security

### Cloud firewall (Linode)
- Ingress allowed: `22/tcp`, `80/tcp`, `443/tcp`
- All other inbound traffic denied.

### Host firewall (UFW)
- Default inbound policy: deny.
- Allows:
  - `80/tcp`
  - `443/tcp`
- SSH is rate-limited:
  - `22/tcp` uses UFW `LIMIT` to reduce brute-force attempts.

### Listening services
Expected host-level listeners:
- `sshd` on 22
- Traefik on 80/443

Postgres is not published to the host.

### Traefik edge rate limiting
Applied via app router middleware:
- Average: 30 requests/second
- Burst: 60
- Period: 1 second

## 3) Brute-force and intrusion resistance

### fail2ban
- fail2ban enabled.
- sshd jail tuned:
  - `maxretry = 3`
  - `findtime = 10m`
  - `bantime = 1h`
  - incremental ban duration enabled

## 4) Secrets management

### Secrets in git
- Real secrets are not committed.
- `.env` is gitignored.
- `.env.example` exists for documentation only.

Important: do not commit OAuth secrets or `NEXTAUTH_SECRET` into Ansible `group_vars`.
Use local-only var files, CI secrets, or a secrets manager.

### Secrets on the server
- Stored in `/etc/stack/secrets` (root-owned, `0700`).
- Individual secret files are `0600`.

Postgres password:
- `/etc/stack/secrets/postgres_password`
- Injected into Postgres container via file mount to `/run/secrets/postgres_password`.

## 5) TLS / edge security

### TLS issuance
- Traefik uses Let’s Encrypt HTTP-01 challenge.
- Certificates and account data stored at `/srv/stacks/traefik/acme/acme.json`.

### HTTP-to-HTTPS
- Port 80 redirects to HTTPS.

### Security headers
Enforced via Traefik middleware on the app router:
- `Strict-Transport-Security` (HSTS) with subdomains and preload
- `Content-Security-Policy` (Next.js + Google OAuth aware)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling common sensors

### CSP (keithwilliams.org)
Current CSP is set at Traefik:
- No `unsafe-eval`
- `unsafe-inline` allowed (required for Next.js)
- `img-src` allows `https://*.googleusercontent.com` for profile photos
- `form-action` allows `https://accounts.google.com` for OAuth

## 6) Container security

### Traefik
- Docker provider: `exposedByDefault=false` (only labeled services are exposed).
- Docker socket mounted read-only.
- Container hardening:
  - `read_only: true`
  - `no-new-privileges:true`
  - tmpfs `/tmp`

### App containers
- Prefer unprivileged images.
- Current app uses a non-root Next.js container from Docker Hub.
- Container hardening:
  - `read_only: true`
  - `no-new-privileges:true`
  - `cap_drop: ALL`
  - tmpfs for runtime paths

### Postgres
- No published ports.
- Attached only to internal Docker network.
- Runs as UID/GID `999:999`.
- `no-new-privileges:true` set.

## 7) Network segmentation (Docker)

Networks:
- `traefik_proxy`: Traefik ↔ app traffic
- `backend_internal`: app ↔ Postgres traffic

Postgres attaches only to `backend_internal`.

## 8) Patch management

- Unattended security upgrades enabled.
- Manual patch window is still recommended (monthly at minimum) for:
  - reboot-requiring updates
  - Docker updates
  - image refreshes

## 9) Vulnerability visibility

### Host audit (Lynis)
- Weekly Lynis audit writes to `/srv/reports/lynis/`.

### Container image scan (Trivy)
- Weekly Trivy scans write to `/srv/reports/trivy/`.

Important note:
- Trivy findings may include HIGH/CRITICAL issues in base images; treat these as inputs for upgrade cadence.

## 10) Backups and restore

- Nightly Postgres backups via `pg_dump` to `/srv/backups/postgres/`.
- Restore steps are documented in the runbook.

## 11) Health checks

- A simple curl-based health check runs every 5 minutes and records only failures.

## 12) Application anti-abuse controls

### Honeypot + timing check
Forms include hidden honeypot fields and a timing threshold to reject bot-like submissions.

### Application-level rate limiting
In addition to Traefik, the app enforces per-IP and per-user rate limits for:
- API reads
- Comment creation
- Post creation

## 13) Verification commands (quick)

From your workstation:
- Verify only expected ports are open:
  - `nc -G 2 -z <ip> 22`, `80`, `443`

On the server:
- Effective SSH policy:
  - `sudo sshd -T | egrep 'permitrootlogin|passwordauthentication|denyusers|maxauthtries|allowtcpforwarding|x11forwarding'`
- UFW:
  - `sudo ufw status verbose`
- fail2ban:
  - `sudo fail2ban-client status sshd`
- Container exposure:
  - `docker ps`
  - `docker inspect postgres --format '{{json .NetworkSettings.Ports}}'`

## 13) Known limitations / future improvements

- Replace broad `keith` sudo with a break-glass model.
- Add offsite backups.
- Add monitoring/alerting (uptime and host metrics).
- Consider WAF/rate limiting if you host APIs.
