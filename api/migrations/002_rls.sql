-- Row-level security for direct database access (e.g. Supabase client keys).
-- The FastAPI service connects with a privileged role and enforces the same
-- rules in code; these policies are defence-in-depth so a leaked anon/auth key
-- cannot read other users' data. `app.user_id` / `app.role` are set per
-- request via SET LOCAL when using RLS-aware connections.

create or replace function app_user_id() returns text language sql stable as
$$ select nullif(current_setting('app.user_id', true), '') $$;
create or replace function app_role() returns text language sql stable as
$$ select coalesce(nullif(current_setting('app.role', true), ''), 'anon') $$;

alter table parts enable row level security;
alter table suppliers enable row level security;
alter table supplier_documents enable row level security;
alter table inquiries enable row level security;
alter table part_requests enable row level security;
alter table quotations enable row level security;
alter table saved_vehicles enable row level security;
alter table favourites enable row level security;
alter table users enable row level security;

-- Public catalogue: approved listings of approved suppliers.
create policy parts_public_read on parts for select using (
  moderation = 'approved' and exists (select 1 from suppliers s where s.id = supplier_id and s.status = 'approved')
);
create policy parts_owner_all on parts for all using (
  exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = app_user_id())
);
create policy parts_admin_all on parts for all using (app_role() = 'admin');

create policy suppliers_public_read on suppliers for select using (status = 'approved');
create policy suppliers_owner on suppliers for all using (owner_id = app_user_id());
create policy suppliers_admin on suppliers for all using (app_role() = 'admin');

create policy docs_owner on supplier_documents for all using (
  exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = app_user_id())
);
create policy docs_admin on supplier_documents for all using (app_role() = 'admin');

create policy inquiries_customer on inquiries for select using (customer_id = app_user_id());
create policy inquiries_supplier on inquiries for select using (
  exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = app_user_id())
);
create policy inquiries_admin on inquiries for all using (app_role() = 'admin');

-- Suppliers only see requests they were matched to; contact fields are
-- redacted by the API until the customer accepts their quotation.
create policy requests_customer on part_requests for all using (customer_id = app_user_id());
create policy requests_matched_supplier on part_requests for select using (
  exists (select 1 from request_matches m join suppliers s on s.id = m.supplier_id
          where m.request_id = part_requests.id and s.owner_id = app_user_id())
);
create policy requests_admin on part_requests for all using (app_role() = 'admin');

create policy quotes_supplier on quotations for all using (
  exists (select 1 from suppliers s where s.id = supplier_id and s.owner_id = app_user_id())
);
create policy quotes_customer on quotations for select using (
  exists (select 1 from part_requests r where r.id = request_id and r.customer_id = app_user_id())
);
create policy quotes_admin on quotations for all using (app_role() = 'admin');

create policy vehicles_owner on saved_vehicles for all using (user_id = app_user_id());
create policy favourites_owner on favourites for all using (user_id = app_user_id());
create policy users_self on users for select using (id = app_user_id());
create policy users_admin on users for all using (app_role() = 'admin');
