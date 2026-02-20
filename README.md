# Single-Server Hosting Platform (Linode + Traefik)

Production-ready single-server hosting platform for a solo software engineer / AI consultant.

This repository provisions and operates a secure Linode-based platform using Terraform, Ansible, Traefik, Docker Compose, and Postgres. It currently hosts **keithwilliams.org**, a Next.js blog with Google OAuth (Auth.js v5), role-based access control, and comments.

## What this system does

- Provisions one Ubuntu 24.04 Linode instance and cloud firewall with Terraform
- Hardens the host with Ansible (SSH lockdown, UFW, fail2ban, unattended upgrades)
- Runs Traefik as edge reverse proxy with automatic Let's Encrypt TLS
- Runs Postgres 16 on an internal-only Docker network (no host port binding)
- Runs app stacks via Docker Compose (one stack per app/domain)
- Runs Watchtower for image auto-updates from Docker Hub
- Schedules backups, security scans, and basic health checks

## Current topology

- Edge: Traefik (`:80` redirect, `:443` TLS termination)
- App: https://keithwilliams.org (Next.js blog from Docker Hub)
- Data: Postgres 16 (`backend_internal` only)
- CI/CD: GitHub Actions → Docker Hub → Watchtower auto-pull/restart
- Edge protections: Traefik security headers + rate limiting

## Repo layout

- `infra/terraform/` Linode instance + firewall
- `bootstrap/ansible/` host bootstrap, hardening, and stack deployment
- `stacks/traefik/` Traefik compose stack
- `stacks/postgres/` Postgres compose stack
- `stacks/watchtower/` Watchtower compose stack
- `stacks/apps/keithwilliams.org/` keithwilliams.org app compose stack (Docker Hub image)
- `docs/` owner and operations documentation

## Read this first

- [Owner Manual](docs/OWNER_MANUAL.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Security Practices](docs/SECURITY_PRACTICES.md)
- [Runbook](docs/RUNBOOK.md)
- [Performance: Lighthouse](docs/performance/LIGHTHOUSE.md)

## Quick start

1. Provision infra with Terraform
2. Point DNS records (`@` and `www`) at the server IP
3. Run the Ansible playbook to harden + deploy stacks
4. Push to the app repo `main` branch — CI/CD handles the app image; Watchtower deploys it

Exact commands live in [Runbook](docs/RUNBOOK.md).

## Security notes

- Never commit real secrets (`.env`, token files, host secret files).
- Rotate Linode API tokens after setup and after any accidental exposure.
- Keep firewall externally limited to ports 22, 80, 443.

## Day-1 usage summary

1. Provision infrastructure with Terraform.
2. Point DNS records (`@` and `www`) to the server IP.
3. Run Ansible playbook to harden host and deploy stacks.
4. Validate HTTPS, backup artifacts, and report jobs.
5. Use the app-stack pattern to onboard additional domains/services.

For exact commands, see [Runbook](docs/RUNBOOK.md).
