-- A business always keeps its owner. Users already can't remove the owner's staff row (the
-- delete policy), but deleting a user cascades to their staff rows, so deleting an owner's
-- account through the admin API would leave their business with nobody in charge. Only deleting
-- the business itself takes the owner's row with it: by the time the cascade reaches the row,
-- the business is already gone.

create function private.keep_business_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.businesses where id = old.business_id) then
    raise exception 'A business must keep its owner' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger keep_business_owner
  before delete on public.business_staff
  for each row
  when (old.role = 'owner')
  execute function private.keep_business_owner();
