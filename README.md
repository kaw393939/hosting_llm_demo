# Hosting LLM Demo Platform

Production-ready single-server hosting platform for a solo software engineer / AI consultant.

This repository provisions and operates a secure Linode-based platform using Terraform, Ansible, Traefik, Docker Compose, and Postgres. It is designed for low-to-moderate traffic client/demo sites with repeatable infrastructure and practical operations.

## What this system does

- Provisions one Ubuntu 24.04 Linode instance and cloud firewall with Terraform.
- Hardens the server with Ansible (SSH lockdown, firewall rules, fail2ban, unattended upgrades, journald caps).
- Deploys Traefik as edge reverse proxy with automatic Let’s Encrypt certificates.
- Deploys Postgres on an internal-only Docker network (not internet-exposed).
- Deploys app stacks in a multi-domain pattern where each app is a separate Compose stack.
- Schedules backups, security scans, and health checks.

## Current topology

- Edge: Traefik (`:80`, `:443`)
- App: `keithwilliams.org` + `www.keithwilliams.org` (nginx static hello app)
- Data: Postgres 16 (internal Docker network only)
- Reports: backup, Lynis, Trivy, health logs on host filesystem

## Tech stack

- Infrastructure as Code: Terraform + Linode provider
- Configuration Management: Ansible
- Container Runtime: Docker + Compose v2
- Reverse Proxy / TLS: Traefik v3 + Let’s Encrypt HTTP-01
- Database: PostgreSQL 16
- Security/Ops: UFW, fail2ban, unattended-upgrades, Lynis, Trivy

## Repository structure

- `infra/terraform/` Linode server and firewall
- `bootstrap/ansible/` host bootstrap, hardening, and stack deployment
- `stacks/traefik/` Traefik compose stack
- `stacks/postgres/` Postgres compose stack
- `stacks/apps/keithwilliams.org/` initial site compose stack
- `docs/` owner and operations documentation

## Read this first

- [Owner Manual](docs/OWNER_MANUAL.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Runbook](docs/RUNBOOK.md)
- [Next Steps for Solo Consultant Platform](docs/NEXT_STEPS_SOLO_CONSULTANT.md)

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
