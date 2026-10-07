-- 035: "For her" and "For him" Store sections.
-- Safe to re-run.

alter table store_products drop constraint if exists store_products_category_check;
alter table store_products add constraint store_products_category_check
  check (category in ('her', 'him', 'cuddly', 'jewelry', 'cozy', 'gift', 'keepsake'));
