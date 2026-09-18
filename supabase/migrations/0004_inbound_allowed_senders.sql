-- Inbound sender allowlist. Empty = accept email from anyone (the pre-0004 behaviour).
-- Entries are lower-cased full addresses ("pastor@eajc.org") or domains ("@eajc.org").
alter table app_settings
  add column if not exists inbound_allowed_senders text[] not null default '{}';
