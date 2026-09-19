-- Scriptures section of the Sunday queue: every slide belongs to a section, and templates
-- gain a 'scripture' category (only shown in the Scriptures view).
create type slide_section as enum ('announcements', 'scriptures');

alter table slides
  add column if not exists section slide_section not null default 'announcements';

-- Each section keeps its own contiguous sort_order.
create index if not exists slides_sunday_section_sort_idx on slides (sunday_id, section, sort_order);

-- Cannot be used in the same transaction it is added in (Postgres rule); nothing below needs it.
alter type template_category add value if not exists 'scripture';
