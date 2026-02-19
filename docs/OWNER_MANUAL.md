# Owner Manual

This manual explains what this platform is, how it behaves, and how to safely operate it as the owner.

## 1) System purpose

This platform gives you a repeatable, secure way to host your own sites and lightweight client projects on a single Linode server.

Design goals:
- Low operational overhead.
- Secure defaults without requiring enterprise complexity.
- Simple pattern to add more domains/apps.
- Practical controls for backups and vulnerability visibility.

## 2) Core operating model

The platform is split into three layers:

1. Provisioning layer (`infra/terraform`)
   - Creates Linode VM + cloud firewall.
2. Host configuration layer (`bootstrap/ansible`)
   - Hardens Ubuntu, installs Docker, creates users/directories/secrets, deploys stacks, sets cron jobs.
3. Runtime layer (`stacks/*`)
   - Traefik handles edge routing/TLS.
   - App containers serve content.
   - Postgres handles persistence on internal network.

## 3) Security baseline currently implemented

- SSH root login disabled in effective config.
- Password authentication disabled; key-based SSH only.
- UFW configured to allow only `22/tcp`, `80/tcp`, `443/tcp` inbound.
- Linode cloud firewall also restricts to the same ports.
- fail2ban enabled for brute-force resistance.
- unattended-upgrades enabled.
- Secrets stored in `/etc/stack/secrets` (root-owned, restricted permissions).
- Postgres has no public port binding and is attached only to `backend_internal` network.
- `keith` is not in the Docker group; Docker operations are performed as `deploy`.
- Direct SSH login as `deploy` is blocked (`DenyUsers deploy`).

SSH hardening additions:
- SSH rate-limited via UFW (`LIMIT` on 22/tcp)
- fail2ban tuned to `maxretry=3` with increasing ban duration

## 4) Networking behavior

- `web` entrypoint on port 80 redirects to HTTPS.
- `websecure` entrypoint on port 443 terminates TLS.
- Domain routing is label-driven in app stack compose files.
- Postgres is reachable by service name on internal Docker network, not from internet.

Web response hardening:
- HSTS enabled
- CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy enabled via Traefik middleware

## 5) Certificate behavior

- Traefik uses Let’s Encrypt HTTP-01 challenge.
- DNS must point to this server for issuance/renewal to succeed.
- ACME storage file is `/srv/stacks/traefik/acme/acme.json`.

Operational implication:
- If DNS temporarily points elsewhere, renewals can fail.
- Traefik logs are the primary source for ACME diagnosis.

## 6) Data and state

Persistent paths:
- Traefik ACME state: `/srv/stacks/traefik/acme/acme.json`
- Postgres data: `/srv/stacks/postgres/data`
- Postgres backups: `/srv/backups/postgres`
- Security reports: `/srv/reports/lynis`, `/srv/reports/trivy`
- Health check alerts: `/srv/reports/health/alerts.log`

## 7) Scheduled operations

Cron jobs are installed as root:
- Nightly Postgres backup (`02:10`)
- Weekly Lynis (`Sun 03:30`)
- Weekly Trivy (`Sun 03:45`)
- 5-minute HTTP health check

## 8) How to onboard a new site/domain

1. Create app folder under `stacks/apps/<domain>/`.
2. Add compose file with:
   - service container
   - `traefik.enable=true`
   - router `Host(...)`
   - `tls=true` and `tls.certresolver=le`
   - `traefik_proxy` network
3. Deploy updated stack (copy + `docker compose up -d` or rerun Ansible).
4. Add DNS records at registrar.
5. Validate:
   - HTTP redirect
   - HTTPS 200
   - certificate SAN contains expected hostnames

## 9) Incident response quick guide

If site is down:
1. Check host reachability and open ports (`22/80/443`).
2. Check running containers (`docker ps`).
3. Check Traefik logs for routing or ACME errors.
4. Validate DNS A/AAAA values.
5. Roll/restart impacted stack.

If certificate fails:
1. Confirm DNS points to this host.
2. Ensure port 80 is reachable externally.
3. Inspect Traefik logs for ACME challenge mismatch.
4. Recreate Traefik container after DNS correction.

If DB issue:
1. Check Postgres health status in `docker ps`.
2. Review `docker logs postgres`.
3. Restore latest backup if needed.

## 10) Ownership responsibilities

As owner/operator, you should:
- Rotate sensitive tokens and SSH keys on a schedule.
- Apply monthly patch/upgrade window.
- Review weekly security reports.
- Test restore process quarterly.
- Keep documentation in this repo current as topology evolves.

## 11) Known constraints of current architecture

- Single VM means no high availability.
- Backups are local-only unless you add offsite sync.
- No centralized metrics dashboard by default.
- No staging/production split yet.

## 12) Recommended operating cadence

Daily:
- Quick site smoke check.

Weekly:
- Review Trivy/Lynis outputs and failed health alerts.

Monthly:
- Update base images and redeploy stacks.
- Rotate API token if policy requires.

Quarterly:
- Disaster recovery simulation from backup.
- SSH key and account access audit.
