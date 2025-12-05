-- Create jds table
CREATE TABLE IF NOT EXISTS jds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  brief_context TEXT,
  tone TEXT NOT NULL CHECK (tone IN ('standard', 'executive', 'technical', 'client-facing')),
  seniority TEXT NOT NULL CHECK (seniority IN ('junior', 'mid', 'senior', 'lead', 'director+')),
  length TEXT NOT NULL CHECK (length IN ('short', 'standard', 'detailed')),
  sections JSONB NOT NULL,
  full_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_jds_created_at ON jds(created_at DESC);

-- Create index on job_title for search
CREATE INDEX IF NOT EXISTS idx_jds_job_title ON jds(job_title);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_jds_updated_at
  BEFORE UPDATE ON jds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: No RLS policies - all data is public/global

