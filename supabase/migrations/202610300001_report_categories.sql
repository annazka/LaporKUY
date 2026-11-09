-- Extend categories without changing historical reports or submission permissions.
begin;
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (
 category in (
  'Jalan berlubang','Trotoar','Drainase','Lampu jalan',
  'Jembatan','Rambu lalu lintas','Fasilitas umum','Lainnya'
 )
);
commit;
