-- Allow operators to update report priority directly from Peta Kendali while recording an audit entry.
begin;
create or replace function private.operator_update(p_report_id uuid,p_action text,p_message text,p_progress integer,p_start date,p_target date,p_priority text,p_photo_path text)returns void language plpgsql security definer set search_path='' as $$
declare r public.reports; next_status text;old_target date;
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','')<>'operator' then raise exception 'Akses khusus operator.';end if;
 select * into r from public.reports where id=p_report_id for update;if not found then raise exception 'Laporan tidak ditemukan.';end if;
 if length(trim(p_message))<10 or length(p_message)>3000 then raise exception 'Isi keterangan minimal 10 karakter.';end if;
 if r.status in('completed','rejected')then raise exception 'Laporan sudah ditutup.';end if;
 if p_photo_path is not null and (p_photo_path not like auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='report-photos' and name=p_photo_path and owner_id=auth.uid()::text))then raise exception 'Foto tidak valid.';end if;
 old_target:=r.target_date; next_status:=r.status;
 if p_action='verify' then
 if r.status<>'submitted' then raise exception 'Laporan sudah diverifikasi.';end if;
 if p_start is null or p_target is null or p_target<p_start or p_target<(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal mulai dan target selesai wajib valid.';end if;
 next_status:='scheduled';
 elsif p_action='progress' then
 if r.status not in('scheduled','in_progress')then raise exception 'Laporan belum siap diperbarui.';end if;
 if r.start_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal mulai perbaikan belum tiba.';end if;
 if p_progress<r.progress or p_progress>99 then raise exception 'Progres harus meningkat atau tetap, maksimal 99 persen.';end if;
 next_status:='in_progress';p_start:=r.start_date;p_target:=r.target_date;
 elsif p_action='reschedule' then
 if r.status not in('scheduled','in_progress')or p_target is null or p_target<greatest(r.start_date,(now() at time zone 'Asia/Jakarta')::date)then raise exception 'Target baru tidak valid.';end if;
 p_start:=r.start_date;p_progress:=r.progress;
 elsif p_action='finish' then
 if r.status not in('scheduled','in_progress')or p_photo_path is null then raise exception 'Unggah foto hasil perbaikan sebelum menyelesaikan pekerjaan.';end if;
 next_status:='awaiting_confirmation';p_progress:=100;p_start:=r.start_date;p_target:=r.target_date;
 elsif p_action='reject' then
 if r.status<>'submitted' then raise exception 'Hanya laporan yang belum diverifikasi dapat ditolak.';end if;
 next_status:='rejected';p_progress:=0;p_start:=null;p_target:=null;
 elsif p_action='priority' then
 if r.status='awaiting_confirmation' then raise exception 'Laporan sedang menunggu konfirmasi pelapor.';end if;
 if p_priority is null or p_priority not in('low','medium','high','urgent') then raise exception 'Prioritas tidak valid.';end if;
 p_progress:=r.progress;p_start:=r.start_date;p_target:=r.target_date;p_photo_path:=null;
 else raise exception 'Aksi tidak valid.';
 end if;
 update public.reports set status=next_status,priority=p_priority,progress=p_progress,start_date=p_start,target_date=p_target,last_update_at=case when p_action='priority' then r.last_update_at else now() end where id=p_report_id;
 insert into public.report_updates(report_id,kind,message,photo_path,progress,previous_target,new_target)values(p_report_id,p_action,p_message,p_photo_path,p_progress,case when p_action='reschedule'then old_target end,case when p_action in('verify','reschedule')then p_target end);
end;$$;
commit;

select strpos(pg_get_functiondef('private.operator_update(uuid,text,text,integer,date,date,text,text)'::regprocedure), $q$p_action='priority'$q$) > 0 as operator_priority_update_aktif;
