-- Create table for centralized WhatsApp message logs
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  dealer_id text,
  phone text not null,
  client_name text,
  client_username text,
  direction text not null default 'out' check (direction in ('out', 'in')),
  kind text not null default 'manual' check (kind in ('reminder', 'complaint', 'campaign', 'manual', 'other')),
  body text not null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'received')),
  error text,
  lead_id text,
  wa_message_id text,
  created_at timestamptz not null default now()
);

-- Performance and query indexes
create index if not exists idx_whatsapp_messages_session_created on whatsapp_messages (session_key, created_at desc);
create index if not exists idx_whatsapp_messages_session_phone_created on whatsapp_messages (session_key, phone, created_at);
create unique index if not exists idx_whatsapp_messages_session_wa_id on whatsapp_messages (session_key, wa_message_id) where wa_message_id is not null;

-- Enable Realtime publication
alter publication supabase_realtime add table whatsapp_messages;

-- Row Level Security
alter table whatsapp_messages enable row level security;

-- NOTE: The following policies allow read and insert for anon and authenticated roles.
-- These must be tightened with strict tenant isolation and user verification when real auth is added.
create policy "Allow select whatsapp_messages for anon and authenticated"
  on whatsapp_messages for select
  to anon, authenticated
  using (true);

create policy "Allow insert whatsapp_messages for anon and authenticated"
  on whatsapp_messages for insert
  to anon, authenticated
  with check (true);
