-- Adds RunSheet.openedAt (section: simplified Sunday IA, Import modal "new" dot).
-- Set the first time a Sunday Team member previews or uses a run sheet file — drives
-- the unread indicator in the Import modal's "Received files" list.

alter table run_sheets add column opened_at timestamptz;
