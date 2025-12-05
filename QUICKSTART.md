# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- At least one AI provider:
  - `OPENAI_API_KEY` - OpenAI API key (recommended)
  - `ANTHROPIC_API_KEY` - Anthropic API key (fallback)

## 3. Set Up Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_create_jds_table.sql`
4. Run the migration

## 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 5. Generate Your First JD

1. Enter a job title (e.g., "Senior Cloud Architect")
2. Optionally add context
3. Select tone, seniority, and length
4. Click "Generate JD"
5. Wait for AI to generate the JD
6. Edit responsibilities/skills with autocomplete (press Tab to accept)
7. Copy the JD

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env` file exists and contains all required variables
- Restart the dev server after adding environment variables

### "No AI provider available"
- Ensure at least one of `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
- Check that the API keys are valid

### Database errors
- Verify the migration was run successfully
- Check that RLS is disabled (all data is public for MVP)
- Ensure Supabase credentials are correct

### Autocomplete not working
- Check browser console for errors
- Verify API route `/api/autocomplete` is accessible
- Ensure AI provider keys are set

