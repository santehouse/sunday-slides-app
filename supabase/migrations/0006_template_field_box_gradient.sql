-- Gradient box fills for template fields (Studio → Box fill → Gradient): {"angle": 180,
-- "stops": ["#f6d3ae", "#e9b98a"]}, 2–7 hex stops. When set it takes precedence over box_color.
alter table template_fields
  add column if not exists box_gradient jsonb;
