-- 031: "It arrived!" — the recipient of a gift can mark it delivered.
-- Safe to re-run.
create or replace function public.confirm_gift_arrived(p_order uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update store_orders set status = 'delivered', updated_at = now()
   where id = p_order and recipient_id = auth.uid()
     and status in ('paid', 'fulfilling', 'shipped')
$$;
revoke all on function public.confirm_gift_arrived(uuid) from public, anon;
grant execute on function public.confirm_gift_arrived(uuid) to authenticated;
