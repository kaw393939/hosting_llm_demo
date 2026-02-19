# Single-Server Linode Platform Runbook

## Current deployed server
- IPv4: `69.164.214.207`
- Host label: `keith-platform`
- OS: Ubuntu 24.04
- Size: `g6-nanode-1` (2GB)

## Current access model
- `keith` is admin for SSH and sudo operations.
- `keith` is intentionally **not** in the Docker group.
- `deploy` owns stack files and runs Docker/Compose, but direct SSH login as `deploy` is intentionally blocked.

Docker operations:
- Run Docker commands via `deploy` locally on the host (interactive shell), or use `sudo -u deploy ...` from `keith`.

## Repository layout
- `infra/terraform/` Linode instance + firewall
- `bootstrap/ansible/` hardening + Docker + deployment
- `stacks/traefik/` edge router
- `stacks/postgres/` internal Postgres
- `stacks/apps/keithwilliams.org/` hello site app

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
