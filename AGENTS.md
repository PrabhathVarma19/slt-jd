# Agents

## Cursor Cloud specific instructions

### Overview

Beacon is a Next.js 14 (App Router) AI-powered internal Service Desk app for Trianz. Single app (not a monorepo) using npm as the package manager.

### Services

| Service | How to start | Notes |
|---------|-------------|-------|
| Local Supabase (PostgreSQL) | `supabase start` (requires Docker) | Provides DB, Auth, Storage, REST API. Must run before the Next.js dev server. |
| Next.js dev server | `npm run dev` | Runs on http://localhost:3000 |

### Local Supabase setup

Docker must be running before `supabase start`. In the Cloud Agent VM:

```bash
sudo dockerd &>/tmp/dockerd.log &
sleep 3
sudo chmod 666 /var/run/docker.sock
```

Then start Supabase: `supabase start` from `/workspace`. The migration `002_policy_vectors.sql` requires the pgvector extension; the migration `0015_enable_vector.sql` enables it automatically.

After Supabase starts, run the core DB setup: `docker exec -i supabase_db_workspace psql -U postgres -d postgres < scripts/setup-database-complete.sql`

Local Supabase URLs/keys are output by `supabase status -o env`. The `.env` file should use these local values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

### Test credentials

- Email: `user@trianz.com`
- Password: `test123`
- Role: SUPER_ADMIN

### Key commands

See `package.json` scripts. Standard commands:
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint (warnings only, no errors expected)

### Environment variables / secrets

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are injected as environment variables by the Cloud Agent VM. The `.env` file must reference them (not hardcode placeholders). When creating or updating `.env`, write the actual values from the shell environment, e.g.:

```bash
sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_API_KEY|" .env
sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|" .env
```

### Gotchas

- `.npmrc` sets `legacy-peer-deps=true` which is required for `npm install` to succeed.
- The `postinstall` script patches `pdf-parse` to disable debug mode; this runs automatically.
- The `canvas` optional dependency may fail to build natively — this is non-blocking.
- AI features (JD generation, policy Q&A, comms drafting, etc.) require valid `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. Without them, the app runs but AI routes return errors.
- Email features (ticket notifications) require Azure/Graph API credentials. Without them, tickets are created but no emails are sent.
- Build output shows "DYNAMIC_SERVER_USAGE" errors during static generation — these are expected and not failures (API routes use cookies so they're rendered dynamically).
- When restarting the dev server, kill existing `next-server` processes first to avoid port conflicts. Use `fuser -k 3000/tcp` before `npm run dev`.
