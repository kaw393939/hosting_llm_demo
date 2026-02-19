# Technical Architecture

## 1) Components

### Infrastructure
- Linode VM (Ubuntu 24.04)
- Linode cloud firewall (ingress: 22/80/443)

### Host users
- `keith`: admin user (sudo, docker group)
- `deploy`: deployment/runtime user for stack ownership

### Runtime services
- Traefik v3.x
- Postgres 16 (internal network only)
- Per-domain app services (current: nginx hello site)

## 2) Directory layout on host

- `/srv/stacks/traefik`
- `/srv/stacks/postgres`
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
4. Traefik matches Host rule from Docker labels.
5. Traefik forwards to target container over `traefik_proxy`.

## 5) TLS flow

- Let’s Encrypt HTTP-01 challenge handled by Traefik.
- Cert metadata/state persisted in `acme.json`.
- Renewal managed by Traefik automation.

## 6) Data flow

- App services connect to Postgres via Docker internal network alias.
- Nightly backup job uses `pg_dump`, compresses to `.sql.gz`.
- Restore uses `psql` piped from decompressed backup.

## 7) Security controls

Host level:
- UFW + cloud firewall defense-in-depth.
- fail2ban for SSH abuse mitigation.
- SSH hardening via drop-in config.

Container level:
- `exposedByDefault=false` in Traefik provider.
- Only explicitly labeled app containers are routable.
- Postgres isolated from public network.

Secrets:
- File-based secret injection from root-owned path.

## 8) Build and deployment model

- Infra lifecycle: Terraform `init/plan/apply/destroy`
- Config/deploy lifecycle: Ansible playbook idempotent re-run
- Runtime lifecycle: Compose stacks restart with `unless-stopped`

## 9) Operational observability

Current observability primitives:
- Container logs (`docker logs ...`)
- Host security reports (Lynis, Trivy)
- Healthcheck log file for domain checks

Recommended future enhancement:
- Add metrics and centralized logging stack.

## 10) Failure domains

Single-node risk profile:
- VM outage impacts all hosted domains and DB.
- Disk corruption risks local backup strategy.

Mitigation path:
- Offsite backup sync.
- Warm standby or multi-node migration plan.
