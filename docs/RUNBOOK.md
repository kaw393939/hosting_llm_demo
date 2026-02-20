# Single-Server Linode Platform Runbook

## Current deployed server

This runbook intentionally does not hardcode your server IP.

Convention used by this repo:
- Store the current server IPv4 in `server_ip.txt` (gitignored)

## Current access model
- `keith` is admin for SSH and sudo operations.
- `keith` is intentionally **not** in the Docker group.
- `deploy` owns stack files and runs Docker/Compose, but direct SSH login as `deploy` is intentionally blocked.

Docker operations:
- Run Docker commands via `deploy` locally on the host (interactive shell), or use `sudo -u deploy ...` from `keith`.

Security reference:
- See [Security Practices](SECURITY_PRACTICES.md) for the complete list of hardening controls and verification commands.

## Repository layout
- `infra/terraform/` Linode instance + firewall
- `bootstrap/ansible/` hardening + Docker + deployment
- `stacks/traefik/` edge router
- `stacks/postgres/` internal Postgres
- `stacks/watchtower/` auto-updates for Docker Hub images
- `stacks/apps/keithwilliams.org/` keithwilliams.org blog (Docker Hub image)

## Local prerequisites
- Terraform binary in `./.tools/bin/terraform`
- Ansible in `./.tools/ansible-venv`
- Local `.env` file with `linode=<PAT>`
- SSH key at `~/.ssh/id_rsa` and `~/.ssh/id_rsa.pub`

## Provision infrastructure
```bash
cd infra/terraform
export LINODE_TOKEN=$(grep '^linode=' ../../.env | cut -d= -f2-)
export TF_VAR_linode_token="$LINODE_TOKEN"
export TF_VAR_admin_authorized_key="$(cat ~/.ssh/id_rsa.pub)"
../../.tools/bin/terraform init
../../.tools/bin/terraform apply -auto-approve
../../.tools/bin/terraform output -raw public_ipv4
```

Write the output IP to `server_ip.txt`.

## Prepare Ansible files (local-only)

1. Inventory:
  - Copy `bootstrap/ansible/inventories/hosts.ini.example` → `bootstrap/ansible/inventories/hosts.ini`
  - Set `ansible_host=YOUR_SERVER_IP` and `ansible_user=keith`

2. Secrets:
  - Copy `bootstrap/ansible/group_vars/all.secrets.yml.example` → `bootstrap/ansible/group_vars/all.secrets.yml`
  - Fill in `google_client_id`, `google_client_secret`, `nextauth_secret`

Both files are gitignored.

## DNS records (GoDaddy)
Set:
- `A @ -> <server_ipv4>`
- `A www -> <server_ipv4>`

(Optionally add matching `AAAA` using Terraform output `public_ipv6`.)

## Bootstrap + deploy stacks
```bash
cd bootstrap/ansible
../../.tools/ansible-venv/bin/ansible-playbook \
  -i inventories/hosts.ini playbook.yml \
  -e @group_vars/all.secrets.yml \
  --private-key ~/.ssh/id_rsa \
  -e 'admin_pubkey={{ lookup("file", "~/.ssh/id_rsa.pub") }}' \
  -e 'deploy_pubkey={{ lookup("file", "~/.ssh/id_rsa.pub") }}' \
  -e 'ansible_host=<server_ipv4>'
```

## Validation checklist
- SSH as admin user:
```bash
ssh -i ~/.ssh/id_rsa keith@<server_ipv4>
```
- Ports:
```bash
for p in 22 80 443 25 8080 5432; do nc -G 2 -z <server_ipv4> "$p" && echo "$p open" || echo "$p closed"; done
```
Expected open: `22,80,443`; expected closed: `25,8080,5432`.

- Containers:
```bash
ssh -i ~/.ssh/id_rsa keith@<server_ipv4> 'docker ps'
```

- Routing:
```bash
curl -sSI -H 'Host: keithwilliams.org' http://<server_ipv4> | head -n 5
curl -skSI --resolve keithwilliams.org:443:<server_ipv4> https://keithwilliams.org | head -n 12
curl -skSI --resolve www.keithwilliams.org:443:<server_ipv4> https://www.keithwilliams.org | head -n 12

# Auth/RBAC protections
curl -skSI https://keithwilliams.org/new | head -n 5
curl -skSI https://keithwilliams.org/admin | head -n 5

# API method restriction
curl -skS -X POST https://keithwilliams.org/api/posts
curl -skS -X DELETE https://keithwilliams.org/api/posts
```

## App deployment model (keithwilliams.org)

Normal path:
- Push to the app repo `main` branch
- GitHub Actions builds/pushes the Docker image to Docker Hub
- Watchtower pulls the new `:latest` image and restarts the container

Manual pull (if you want to force an update immediately):
```bash
ssh -i ~/.ssh/id_rsa keith@<server_ipv4>
cd /srv/stacks/apps/keithwilliams.org
sudo -u deploy docker compose up -d --pull always --remove-orphans
```

## Auth.js (Google OAuth) configuration gotcha

Auth.js v5 may require `AUTH_URL` and `AUTH_SECRET` (in addition to the legacy
`NEXTAUTH_URL` / `NEXTAUTH_SECRET`) depending on your version and deployment.

This stack sets:
- `NEXTAUTH_URL=https://keithwilliams.org`
- `AUTH_URL=https://keithwilliams.org`
- `NEXTAUTH_SECRET=<random>`
- `AUTH_SECRET=<same as NEXTAUTH_SECRET>`

Safe verification (prints only lengths, never values):

```bash
ssh -i ~/.ssh/id_rsa keith@<server_ipv4> \
  'sudo -u deploy sh -lc "cd /srv/stacks/apps/keithwilliams.org; set -a; . ./.env; \
    echo NEXTAUTH_SECRET_len=${#NEXTAUTH_SECRET}; echo AUTH_SECRET_len=${#AUTH_SECRET}; \
    echo NEXTAUTH_URL_len=${#NEXTAUTH_URL}; echo AUTH_URL_len=${#AUTH_URL}"'
```

### Secret rotation (recommended)

Rotate the auth secret via Ansible so your **local-only** secrets file stays the source of truth:

1) Update `bootstrap/ansible/group_vars/all.secrets.yml`:
- set a new `nextauth_secret` (e.g. `openssl rand -base64 32`)

2) Re-run the playbook (see “Bootstrap + deploy stacks”).

Notes:
- Rotating the secret invalidates existing sessions (users will need to sign in again).
- Avoid editing `/srv/stacks/apps/keithwilliams.org/.env` by hand except as a break-glass recovery.

## Admin recovery (if you can't post)

Posting is admin-only. If your user is not an admin and you don't have access to an existing admin account, use the break-glass CLI inside the running container.

On the server:

```bash
sudo -u deploy docker exec -i keithwilliams_blog node scripts/admin.mjs list-users
sudo -u deploy docker exec -i keithwilliams_blog node scripts/admin.mjs promote --email keith@firehose360.com
```

## Notes on TLS issuance
Let’s Encrypt HTTP-01 works only when public DNS for `keithwilliams.org` and `www.keithwilliams.org` points to this server. If records point elsewhere, Traefik logs ACME authorization failures.

## Secrets model
- Host secret path: `/etc/stack/secrets`
- Postgres password file: `/etc/stack/secrets/postgres_password`
- Traefik ACME state: `/srv/stacks/traefik/acme/acme.json`

## Backups, scans, health schedules
Root cron entries:
- `10 2 * * * /usr/local/bin/postgres-nightly-backup.sh`
- `30 3 * * 0 /usr/local/bin/weekly-lynis.sh`
- `45 3 * * 0 /usr/local/bin/weekly-trivy.sh`
- `*/5 * * * * /usr/local/bin/http-healthcheck.sh`

Paths:
- Backups: `/srv/backups/postgres/`
- Lynis reports: `/srv/reports/lynis/`
- Trivy reports: `/srv/reports/trivy/`
- Health alerts: `/srv/reports/health/alerts.log`

## Restore Postgres
1. Identify backup file:
```bash
ls -lh /srv/backups/postgres
```
2. Restore into running container:
```bash
gunzip -c /srv/backups/postgres/postgres_YYYY-MM-DD_HHMMSS.sql.gz | \
  docker exec -i postgres sh -c 'PGPASSWORD="$(cat /run/secrets/postgres_password)" psql -U app -d app'
```

## Add a new domain/app
1. Create new app stack folder under `stacks/apps/<domain>/` with a `compose.yaml`.
2. Add Traefik labels:
- `traefik.enable=true`
- `traefik.docker.network=traefik_proxy`
- router rule `Host(...)`
- `entrypoints=websecure`, `tls=true`, `tls.certresolver=le`
3. Join `traefik_proxy` network; do not publish app ports to host.
4. Copy to server and deploy as `deploy` or re-run Ansible.
5. Add DNS A/AAAA records for new hostnames.

## Token rotation
After setup, rotate Linode PAT in Linode Cloud Manager and update local `.env` only.

## Destroy everything
```bash
cd infra/terraform
export LINODE_TOKEN=$(grep '^linode=' ../../.env | cut -d= -f2-)
export TF_VAR_linode_token="$LINODE_TOKEN"
export TF_VAR_admin_authorized_key="$(cat ~/.ssh/id_rsa.pub)"
../../.tools/bin/terraform destroy -auto-approve
```
