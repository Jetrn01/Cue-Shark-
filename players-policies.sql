-- PottersMate V3: allow authenticated organisers to manage players and competition registrations.

create policy "Organisers can create players"
on players
for insert
to authenticated
with check (exists (select 1 from organisers where id = auth.uid()));

create policy "Organisers can update players"
on players
for update
to authenticated
using (exists (select 1 from organisers where id = auth.uid()))
with check (exists (select 1 from organisers where id = auth.uid()));

create policy "Organisers can delete players"
on players
for delete
to authenticated
using (exists (select 1 from organisers where id = auth.uid()));

create policy "Organisers can add competition players"
on competition_players
for insert
to authenticated
with check (exists (select 1 from organisers where id = auth.uid()));

create policy "Organisers can update competition players"
on competition_players
for update
to authenticated
using (exists (select 1 from organisers where id = auth.uid()))
with check (exists (select 1 from organisers where id = auth.uid()));

create policy "Organisers can delete competition players"
on competition_players
for delete
to authenticated
using (exists (select 1 from organisers where id = auth.uid()));
