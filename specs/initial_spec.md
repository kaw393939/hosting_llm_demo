Below is a **short, concrete specification / letter** you can hand to your coding agent. It assumes:

* **One Linode server** (no extra servers).
* **Domains are on GoDaddy DNS** (we will use HTTP-01 for Let’s Encrypt, no Linode DNS automation).
* We will use **Traefik** as the edge router for **many domains**.
* We need **Postgres** on the same host.
* We want a **balanced security + usability** posture.
* The first domain is **keithwilliams.org**.

---

## Letter / Spec to Coding Agent — “Single-Server Traefik Platform on Linode”

### Objective

Provision and harden **one Linode VM** and deploy a **containerized multi-domain hosting platform** using **Traefik + Docker Compose + Postgres**, starting with **keithwilliams.org**. The end state is a repeatable, documented, secure setup where adding a new domain/app is mostly “drop in a compose file + labels”.

### Non-negotiables (security + hygiene)

1. **Never commit secrets** (Linode PAT, DB passwords, etc.) to Git history.

   * If a token is currently present in a local repo: remove it from tracked files, add to `.gitignore`, rotate the token if it was ever committed.
2. Use **file-based secrets** (preferred) or encrypted secrets (SOPS/age) on the server.
3. Host must be hardened: **no root SSH**, key-only auth, firewall locked to **22/80/443**.
4. All services run **as unprivileged users** where practical (container user + host directory ownership).

---

## 1) Infrastructure provisioning (Terraform)

### Why Terraform (even for one server)

We want reproducibility: rebuildable host + firewall + optional volume.

### Terraform must create

* **1× Linode instance** (Shared CPU is fine)

  * Recommend **4GB ($24/mo)** for stability if Postgres + multiple containers, but **2GB ($12/mo)** acceptable for light use.
* **Linode Cloud Firewall**

  * Inbound allow: `22/tcp`, `80/tcp`, `443/tcp`
  * Everything else denied inbound
* Optional but recommended:

  * **Block Storage volume** mounted at `/srv/data` (good for Postgres data durability + separation)
  * Enable Linode **Backups** (paid add-on; still “one server”)

### Terraform outputs

* Public IPv4 (and IPv6 if configured)
* Hostname
* Any volume IDs (if used)

### Token usage

* Linode PAT is used **only** for provisioning resources. It must be loaded via environment variable locally (e.g. `LINODE_TOKEN`) and never written into repo-tracked files.

---

## 2) Host bootstrap + hardening (cloud-init or Ansible)

### Approach

After Terraform creates the VM, bootstrap it using **cloud-init** (preferred for first boot) or **Ansible** (preferred for repeatability). Either is acceptable, but the result must be **idempotent** (safe to re-run).

### OS-level hardening requirements

* Create admin user: `keith` (sudo)
* Create deploy user: `deploy` (no password login; limited sudo only if required)
* SSH:

  * `PermitRootLogin no`
  * `PasswordAuthentication no`
  * `PubkeyAuthentication yes`
* Firewall:

  * Host-level firewall (ufw or nftables) mirrors cloud firewall: allow 22/80/443 only
* Updates:

  * Enable unattended security updates
* Intrusion resistance:

  * Install and configure **fail2ban** (at least for SSH)
* Logging:

  * journald retention capped; logrotate in place

### Docker requirements

* Install Docker Engine + Compose plugin
* Docker daemon set to start on boot
* Create standard directories:

  * `/srv/stacks/traefik`
  * `/srv/stacks/postgres`
  * `/srv/stacks/apps`
  * `/etc/stack/secrets` (chmod 700)
* Ownership + permissions:

  * `/srv/stacks/*` owned by `deploy` or service users (see below)
  * `/etc/stack/secrets/*` root-owned, `chmod 600` per secret file

### Service account model (balanced usability)

* Host users:

  * `keith` (admin)
  * `deploy` (owns compose stacks, runs deploy commands)
* Containers run as non-root where feasible via `user:` in compose; where not feasible, isolate via networks and least privilege.

---

## 3) Edge routing & TLS (Traefik)

### Traefik deployment

* Traefik runs via Docker Compose in `/srv/stacks/traefik`
* Must support:

  * Docker provider with labels
  * **exposedByDefault=false** (critical)
  * EntryPoints:

    * `web` :80
    * `websecure` :443
  * Automatic HTTPS using Let’s Encrypt **HTTP-01 challenge**

    * Requires port 80 reachable externally
  * HTTP → HTTPS redirect
* Traefik dashboard:

  * Disabled by default OR exposed only behind auth and not publicly discoverable
  * If enabled, restrict via middleware + basic auth + IP allowlist

### Certificates

* Store ACME data in a persistent volume (e.g. `/srv/stacks/traefik/acme/acme.json`)
* Permissions locked down for ACME storage

---

## 4) Application standard (keithwilliams.org first)

### DNS requirement (GoDaddy)

* Create/confirm DNS records at GoDaddy:

  * `A keithwilliams.org -> <server IPv4>`
  * `A www -> <server IPv4>` (optional)
  * If using IPv6: `AAAA` records too
* Wait for propagation, then Traefik should issue cert automatically.

### App deployment pattern

Each app lives under:

* `/srv/stacks/apps/<appname>/compose.yaml`

Apps must:

* Join the `traefik` external network
* Use Traefik labels for routing
* Not publish ports to host unless absolutely necessary

### keithwilliams.org initial service

* Provide a minimal “hello site” container (static) until the real site is deployed.
* Routing rules:

  * `Host(\`keithwilliams.org`) || Host(`[www.keithwilliams.org`)`](http://www.keithwilliams.org`%29`)

---

## 5) Postgres (single-host)

### Postgres deployment

* Compose stack in `/srv/stacks/postgres`
* Container:

  * Postgres stable image (pin a major version)
* Network:

  * Internal-only Docker network (no host port published)
  * Apps connect via Docker network alias (e.g. `postgres:5432`)
* Persistence:

  * Data volume at `/srv/data/postgres` (if volume mounted) OR `/srv/stacks/postgres/data`
* Secrets:

  * `POSTGRES_PASSWORD_FILE` from `/etc/stack/secrets/postgres_password`
* Sensible defaults for small VPS:

  * Conservative memory settings (don’t blow 2GB RAM)
  * Keep connection counts low; optionally include **pgbouncer** if needed

### Backups (required)

* Nightly `pg_dump` to `/srv/backups/postgres`
* Off-box backup recommended (best practice), but if we’re minimizing spend:

  * At minimum: compressed dumps + documented restore procedure
* Document restore steps in the runbook.

---

## 6) Security scanning & health checks (balanced)

### Host scanning

* Weekly scheduled:

  * `lynis audit system` output saved to `/srv/reports/lynis/`

### Container scanning

* Weekly scheduled:

  * `trivy` scan of images used in stacks (critical/high)
  * Save reports to `/srv/reports/trivy/`

### Basic service health

* Provide at least one of:

  * `uptime-kuma` container OR
  * simple curl-based healthcheck cron that alerts (email/log) on failure

---

## 7) Repository layout (deliverables)

Agent must create a repo structure like:

* `infra/terraform/`

  * Linode instance + firewall (+ volume optional)
* `bootstrap/`

  * cloud-init and/or ansible to harden + install docker + create dirs
* `stacks/`

  * `traefik/compose.yaml`
  * `postgres/compose.yaml`
  * `apps/keithwilliams.org/compose.yaml`
* `docs/RUNBOOK.md`

  * How to provision, deploy, add domains, rotate secrets, backup/restore

Secrets handling in repo:

* `.env.example` only (no real values)
* `.env.local` and any `secrets/` folder are gitignored

---

## 8) Acceptance criteria (definition of done)

1. Terraform can provision the server + firewall with one command.
2. `ssh root@host` fails; `ssh keith@host` works with keys.
3. Only ports **22/80/443** are reachable externally.
4. Traefik is running and auto-issues a valid cert for **keithwilliams.org**.
5. Postgres is reachable **only** from containers on the internal network (not from the internet).
6. Security scans run on schedule and write reports to `/srv/reports/...`.
7. Backups are produced nightly and restore instructions are verified/documented.
8. RUNBOOK.md exists and is sufficient for a rebuild.

---

## Autonomy instructions (how the agent should operate)

* Use my Linode PAT (provided locally via environment variable) to run Terraform and provision resources.
* Perform the bootstrap/hardening and deploy stacks end-to-end without manual steps other than:

  * I will set GoDaddy DNS A/AAAA records to the server IP when you output it (or the agent can prompt me once with the exact records to set).
* Produce a final “handoff summary” with:

  * server IP, domain routing status, commands to add a new domain/app, and where secrets live.

---

If you want, I can also include a **copy/paste compose template** for:

* Traefik (with secure defaults)
* Postgres (with secrets + internal network)
* `keithwilliams.org` “hello” app

…but the above spec is already complete enough for an agent to implement end-to-end.
