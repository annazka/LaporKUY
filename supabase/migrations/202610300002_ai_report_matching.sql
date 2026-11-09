-- New RPC for the preview flow; keep the legacy main RPC compatible until promotion.
begin;
create or replace function private.report_distance_m(a_lat double precision,a_lng double precision,b_lat double precision,b_lng double precision)
returns double precision language sql immutable strict set search_path='' as $$
 select 2*6371000*asin(sqrt(least(1,
  power(sin(radians(b_lat-a_lat)/2),2)+cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)
 )));
$$;
create or replace function private.submit_report_ai(p_title text,p_description text,p_category text,p_address text,p_latitude double precision,p_longitude double precision,p_photo_path text,p_duplicate_report_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();rid uuid;count_active integer;
begin
 if uid is null then raise exception 'Silakan masuk terlebih dahulu.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if p_photo_path not like uid::text||'/%' or not exists(select 1 from storage.objects where bucket_id='report-photos' and name=p_photo_path and owner_id=uid::text)then raise exception 'Foto bukti tidak valid.';end if;
 if p_latitude not between -6.5 and -6.05 or p_longitude not between 106.65 and 107.0 then raise exception 'Lokasi harus berada di Jakarta.';end if;
 if length(p_title) not between 8 and 140 or length(p_description) not between 20 and 3000 or length(p_address) not between 8 and 300 then raise exception 'Judul, deskripsi, atau alamat belum lengkap.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_category,1));
 -- Only the explicit visual match is eligible; never search for a distance-only fallback.
 if p_duplicate_report_id is not null then
  select r.id into rid from public.reports r
  where r.id=p_duplicate_report_id and r.category=p_category
   and r.status not in('completed','rejected','awaiting_confirmation')
   and private.report_distance_m(p_latitude,p_longitude,r.latitude,r.longitude)<=25
  for update;
  if rid is null then raise exception 'Laporan pembanding sudah berubah atau lokasinya tidak sesuai. Coba kirim laporan lagi.';end if;
 end if;
 select count(*) into count_active from public.submissions s join public.reports r on r.id=s.report_id where s.user_id=uid and r.status not in('completed','rejected');
 if count_active>=10 and (rid is null or not exists(select 1 from public.submissions where report_id=rid and user_id=uid))then raise exception 'Maksimal 10 laporan aktif. Tunggu salah satu laporan selesai.';end if;
 if rid is null then
  insert into public.reports(title,description,category,address,latitude,longitude,photo_path) values(p_title,p_description,p_category,p_address,p_latitude,p_longitude,p_photo_path) returning id into rid;
  insert into public.submissions(report_id,user_id,photo_path,description,is_primary) values(rid,uid,p_photo_path,p_description,true);
  insert into public.report_updates(report_id,kind,message,progress)values(rid,'submitted','Laporan diterima. Menunggu verifikasi operator.',0);
  return jsonb_build_object('id',rid,'duplicate',false,'already_counted',false);
 end if;
 if exists(select 1 from public.submissions where report_id=rid and user_id=uid)then
  update public.submissions set photo_path=p_photo_path,description=p_description where report_id=rid and user_id=uid;
  return jsonb_build_object('id',rid,'duplicate',true,'already_counted',true);
 end if;
 insert into public.submissions(report_id,user_id,photo_path,description)values(rid,uid,p_photo_path,p_description);
 update public.reports set support_count=support_count+1 where id=rid;
 return jsonb_build_object('id',rid,'duplicate',true,'already_counted',false);
end;
$$;
create or replace function public.submit_report_ai(p_title text,p_description text,p_category text,p_address text,p_latitude double precision,p_longitude double precision,p_photo_path text,p_duplicate_report_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.submit_report_ai(p_title,p_description,p_category,p_address,p_latitude,p_longitude,p_photo_path,p_duplicate_report_id);
$$;
revoke all on function private.report_distance_m(double precision,double precision,double precision,double precision) from public;
revoke all on function private.submit_report_ai(text,text,text,text,double precision,double precision,text,uuid) from public;
revoke all on function public.submit_report_ai(text,text,text,text,double precision,double precision,text,uuid) from public,anon;
grant execute on function public.submit_report_ai(text,text,text,text,double precision,double precision,text,uuid) to authenticated;
-- Existing private-schema USAGE remains as provisioned by the initial migration.
grant execute on function private.submit_report_ai(text,text,text,text,double precision,double precision,text,uuid) to authenticated;
commit;

select to_regprocedure('public.submit_report_ai(text,text,text,text,double precision,double precision,text,uuid)') is not null as ai_upvote_aktif;
