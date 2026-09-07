-- Template fields grow into layers (brand template rebuild from the Canva masters):
--   * field_type 'image' — a picture slot the Sunday team fills (speaker photo), with an
--     optional solid frame;
--   * default_value — text a field shows when the slide has none; locked (non-team-
--     editable) fields always render it, so decorative copy lives on the template;
--   * rotation / box_color / box_padding — angled "sticker" labels on a solid box.
-- Slide content for an image field stores the object-store key of the uploaded picture.

alter table template_fields
  add column default_value text not null default '',
  add column rotation numeric not null default 0,
  add column box_color text,
  add column box_padding integer not null default 0,
  add column frame_color text,
  add column frame_width integer not null default 0;

alter table template_fields
  add constraint template_fields_field_type_check check (field_type in ('text', 'image'));
