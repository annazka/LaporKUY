-- Public previews may show the current repaired condition, not private work-in-progress photos.
begin;
drop policy if exists public_finished_report_preview on storage.objects;
create policy public_finished_report_preview on storage.objects
for select to anon
using (
 bucket_id='report-photos'
 and exists (
  select 1
  from public.report_updates u
  join public.reports r on r.id=u.report_id
  where u.photo_path=name
   and u.kind='finish'
   and r.status in ('awaiting_confirmation','completed')
   and u.id=(
    select latest.id from public.report_updates latest
    where latest.report_id=r.id and latest.kind='finish' and latest.photo_path is not null
    order by latest.created_at desc,latest.id desc limit 1
   )
 )
);
commit;
select exists (
 select 1 from pg_policies
 where schemaname='storage' and tablename='objects'
  and policyname='public_finished_report_preview'
) as foto_selesai_publik_aktif;
