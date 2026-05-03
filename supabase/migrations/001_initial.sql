-- Run in Supabase SQL editor or via CLI for each demo project.

create table if not exists mock_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mock_events_created_at_idx on mock_events (created_at desc);

-- Single “panel” of dynamic image rules per demo DB (upsert by fixed id in app) or multiple rows later
create table if not exists dynamic_content (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Dynamic hero',
  field_path text not null default '',
  default_image_url text,
  mappings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on column mock_events.schema is 'Array of root-level field definitions (recursive: object.fields, array.item)';
comment on column dynamic_content.mappings is 'Array of { "value": string, "imageUrl": string }';

-- Fixed row id used by the API for upsert (one panel per Supabase project)
insert into dynamic_content (id, title, field_path, default_image_url, mappings)
values (
  '00000000-0000-4000-8000-000000000001',
  'Dynamic hero',
  '',
  null,
  '[]'::jsonb
)
on conflict (id) do nothing;
