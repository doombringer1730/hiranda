-- 041: Prints from your memories (Polaroid-style prints, a photo book).
--
-- store_orders.photos: the photos to print, in order (ids from photos). The
-- sender picks them; the server checks they belong to the couple again when
-- it renders the print files, so a stray id can never print someone else's
-- photo.
--
-- Safe to re-run.

alter table store_orders add column if not exists photos uuid[];
alter table store_orders drop constraint if exists store_orders_photos_check;
alter table store_orders add constraint store_orders_photos_check
  check (photos is null or cardinality(photos) between 1 and 200);
