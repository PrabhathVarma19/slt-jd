-- Create policy documents and chunks tables (if not present)
create table if not exists policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  path text not null,
  version text default 'v1',
  effective_date date,
  category text,
  access_level text default 'internal',
  checksum text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists policy_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references policy_documents(id) on delete cascade,
  title text,
  section text,
  page int,
  version text,
  effective_date date,
  category text,
  access_level text,
  chunk text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_policy_chunks_embedding on policy_chunks using ivfflat (embedding vector_cosine_ops);
create index if not exists idx_policy_chunks_category on policy_chunks(category);
create index if not exists idx_policy_chunks_effective_date on policy_chunks(effective_date);
create index if not exists idx_policy_chunks_access on policy_chunks(access_level);

-- Similarity search function
create or replace function match_policy_chunks (
  query_embedding vector(1536),
  filter jsonb default '{}'::jsonb,
  match_count int default 5
) returns table (
  id uuid,
  doc_id uuid,
  title text,
  section text,
  page int,
  version text,
  effective_date date,
  category text,
  access_level text,
  chunk text,
  metadata jsonb,
  similarity double precision
) language sql stable as $$
  select
    pc.id,
    pc.doc_id,
    coalesce(pc.title, pd.title) as title,
    pc.section,
    pc.page,
    pc.version,
    pc.effective_date,
    pc.category,
    pc.access_level,
    pc.chunk,
    pc.metadata,
    1 - (pc.embedding <=> query_embedding) as similarity
  from policy_chunks pc
  left join policy_documents pd on pd.id = pc.doc_id
  where
    (filter->>'category' is null or pc.category = filter->>'category')
    and (filter->>'access_level' is null or pc.access_level = filter->>'access_level')
    and (filter->>'effective_date' is null or pc.effective_date >= (filter->>'effective_date')::date)
  order by pc.embedding <=> query_embedding
  limit match_count;
$$;