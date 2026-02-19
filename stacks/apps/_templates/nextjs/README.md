# Next.js app template (Traefik + Compose)

This is a template for hosting a Next.js app on the platform.

## Requirements
- In your Next.js app `next.config.js`, enable standalone output:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

## Build and run on the server
- Put your Next.js app in a folder under `stacks/apps/<your-domain>/`.
- Copy the `Dockerfile` and `compose.yaml` from this template into that folder.
- Update the Traefik router rule domains.

Deploy via the runbook (Ansible) or from the server:

```bash
cd /srv/stacks/apps/<your-domain>
docker compose up -d --build
```

## Performance defaults
- Uses `output: 'standalone'` so runtime image is smaller.
- Runs as non-root.
- Uses Traefik gzip compression middleware.

## Lighthouse
See `docs/performance/LIGHTHOUSE.md`.
