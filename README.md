# Beacon - AI Service Desk and Self-Service Platform

Beacon is an AI-powered internal Service Desk and self-service platform for Trianz. It combines IT and travel request workflows, approvals, ticketing, and multiple AI assistants in a single Next.js 14 app.

## Current scope

- Authentication with session cookies and role-based access control
- User profile sync from external API (supports multiple project codes per user)
- IT Service Desk request intake with AI classification and email notifications
- Travel Desk request intake with supervisor and travel admin approvals
- Ticketing system with assignments, events, and admin/engineer dashboards
- Self-service actions: password reset (placeholder), account unlock (placeholder), ticket status check
- AI agents:
  - Policy Agent (policy Q and A with citations)
  - New Joiner Buddy (basic)
  - Expenses Coach (basic)
  - Service Desk chat (basic intent and extraction)
- Productivity tools:
  - JD Creator
  - Comms Hub
  - Weekly Brief (UI and generation, history pending)

## Tech stack

- Framework: Next.js 14 (App Router) + TypeScript
- UI: React 18 + Tailwind CSS
- Database: Supabase (PostgreSQL)
- AI: OpenAI (primary) + Anthropic (fallback)
- Email: Microsoft Graph API

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create env file:
   ```bash
   cp .env.example .env
   ```

3. Configure required environment variables (see below).

4. Set up the database:
   - Run `scripts/setup-database-complete.sql` in Supabase SQL editor
   - Run `supabase/migrations/001_create_jds_table.sql` for JD Creator data
   - Optional for vector search: `supabase/migrations/002_policy_vectors.sql`

5. Start dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

## Environment variables

Required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY (or ANTHROPIC_API_KEY)
- AZURE_TENANT_ID
- AZURE_CLIENT_ID
- AZURE_CLIENT_SECRET
- GRAPH_SENDER_UPN
- IT_SERVICEDESK_EMAIL
- TRAVEL_DESK_EMAIL

Optional:
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_APP_URL (for approval links)
- USER_PROFILE_API_URL
- USER_PROFILE_API_USERNAME
- USER_PROFILE_API_PASSWORD
- DEFAULT_USER_PASSWORD (default is test123 for auto-created users)
- CHAT_MODEL (default: gpt-4o-mini)
- POLICY_SOURCE_DIR (default: data/policies)
- NODE_TLS_REJECT_UNAUTHORIZED=0 (dev only for SSL issues)

## Database notes

- `scripts/setup-database-complete.sql` creates core tables (users, roles, tickets, approvals, events).
- The script inserts a test user:
  - Email: user@trianz.com
  - Password: test123
  - Role: SUPER_ADMIN

## Key pages

- /service-desk
- /travel-desk
- /approvals/supervisor
- /approvals/travel-admin
- /admin/dashboard
- /engineer/tickets
- /policy-agent
- /new-joiner
- /expenses-coach
- /jd
- /comms-hub
- /weekly-brief

## Known gaps

- IT request approvals are not implemented yet (travel approvals are done)
- Knowledge Base search endpoint is a placeholder
- Password reset and account unlock are placeholders
- Weekly Brief history and persistence are not implemented
- LangChain packages are installed but not integrated

## Deployment

- Vercel deployment from main branch is supported
- Add all environment variables in Vercel project settings

## License

MIT
