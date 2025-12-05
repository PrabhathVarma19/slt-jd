# RoleDraft - JD Copilot for Leaders

An AI-powered Job Description Creator that helps SLT/CXOs generate professional JDs in seconds.

## Features

- **Generate JD from Job Title**: Create complete job descriptions with optional context
- **AI Autocomplete**: Get intelligent suggestions while editing responsibilities and skills
- **JD Library**: Browse and search all generated JDs
- **Multiple AI Providers**: Supports OpenAI and Anthropic with automatic fallback

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **UI**: React + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4 / Anthropic Claude (with fallback)

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account and project
- OpenAI API key OR Anthropic API key (at least one required)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd roledraft
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# At least one AI provider required
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

4. Set up the database:
   - Go to your Supabase project SQL Editor
   - Run the migration file: `supabase/migrations/001_create_jds_table.sql`

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── library/           # JD library page
│   └── page.tsx           # Main JD creator page
├── components/            # React components
│   ├── jd-creator/        # JD creation components
│   ├── library/           # Library components
│   └── ui/                # Reusable UI components
├── lib/                   # Utility libraries
│   ├── ai/                # AI integration (OpenAI/Anthropic)
│   ├── supabase/          # Supabase clients
│   └── utils.ts           # Helper functions
├── types/                 # TypeScript type definitions
└── supabase/              # Database migrations
```

## Usage

### Generate a JD

1. Enter a job title (e.g., "Senior Cloud Architect")
2. Optionally add context about the role
3. Select tone, seniority level, and length
4. Click "Generate JD"
5. Edit responsibilities and skills with AI autocomplete (press Tab to accept suggestions)
6. Copy the JD to clipboard

### Browse Library

- Visit `/library` to see all generated JDs
- Use the search bar to filter by title or keywords
- Click "Open" to view/edit a JD
- Click "Copy JD" to copy to clipboard

## API Routes

- `POST /api/generate-jd` - Generate a new JD
- `POST /api/autocomplete` - Get autocomplete suggestions
- `GET /api/jds` - List all JDs (with optional query param for search)
- `GET /api/jds/[id]` - Get a specific JD

## Database Schema

The `jds` table stores:
- `id` (UUID)
- `job_title` (text)
- `brief_context` (text, nullable)
- `tone`, `seniority`, `length` (text)
- `sections` (JSONB - structured JD sections)
- `full_text` (text - formatted JD)
- `created_at`, `updated_at` (timestamps)

## Notes

- No authentication required - all JDs are public/global
- Every generation creates a new JD (no updates to existing ones)
- Edits to responsibilities/skills are in-memory only (don't persist to DB)
- AI provider fallback: Tries OpenAI first, falls back to Anthropic if OpenAI fails

## License

MIT

