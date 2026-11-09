-- Integration assertions. All fixture changes are rolled back.
begin;
insert into auth.users(id,email,raw_app_meta_data) values
 ('10000000-0000-4000-8000-000000000001','fixture-one@example.invalid','{}'),
 ('10000000-0000-4000-8000-000000000002','fixture-two@example.invalid','{}');
insert into storage.objects(bucket_id,name,owner_id)values
 ('report-photos','10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg','10000000-0000-4000-8000-000000000001'),
 ('report-photos','10000000-0000-4000-8000-000000000002/10000000-0000-4000-8000-000000000002.jpg','10000000-0000-4000-8000-000000000002');
do $$
declare rid uuid; snap public.reports; result jsonb; denied boolean:=false; redeemed_code text; balance bigint; i integer; today date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if has_table_privilege('authenticated','public.reports','INSERT')then raise exception 'Direct INSERT exposed';end if;
 if has_function_privilege('anon','public.operator_update(uuid,text,text,integer,date,date,text,text)','EXECUTE')then raise exception 'Anonymous RPC exposed';end if;
 if (select public from storage.buckets where id='report-photos')then raise exception 'Photos must be private';end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);
 result:=public.submit_report('Fixture jalan berlubang','Kondisi jalan berlubang untuk pengujian integrasi.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.21,106.84,'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg');
 rid:=(result->>'id')::uuid;
 perform public.submit_report('Fixture jalan berlubang','Kondisi jalan berlubang untuk pengujian integrasi.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.21,106.84,'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg');
 if (select support_count from public.reports where id=rid)<>0 then raise exception 'Same user gained upvote';end if;
 for i in 1..9 loop
 perform public.submit_report('Fixture kuota laporan','Kondisi jalan untuk pengujian batas sepuluh laporan.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.21-i*0.001,106.84,'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg');
 end loop;
 denied:=false;begin perform public.submit_report('Fixture melebihi kuota','Kondisi jalan untuk pengujian batas sepuluh laporan.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.24,106.84,'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg');exception when others then denied:=true;end;
 if not denied then raise exception 'Active report quota bypassed';end if;
 perform public.submit_report('Fixture pembaruan bukti','Memperbarui bukti kasus lama walaupun kuota sudah penuh.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.21,106.84,'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001.jpg');
 denied:=false;
 begin perform public.operator_update(rid,'verify','Pengujian tanpa akses operator',0,today,today+3,'medium',null);exception when others then denied:=true;end;
 if not denied then raise exception 'User obtained operator access';end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{}}',true);
 perform public.submit_report('Fixture jalan berlubang','Bukti tambahan dari pelapor kedua untuk pengujian.','Jalan berlubang','Fixture Jakarta untuk pengujian',-6.21001,106.84001,'10000000-0000-4000-8000-000000000002/10000000-0000-4000-8000-000000000002.jpg');
 if (select support_count from public.reports where id=rid)<>1 then raise exception 'Second user upvote failed';end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"operator"}}',true);
 perform public.operator_update(rid,'verify','Operator memverifikasi dan menjadwalkan perbaikan.',0,today,today+3,'high',null);
 perform public.operator_update(rid,'progress','Persiapan alat dan material sudah dilakukan.',30,null,null,'high',null);
 perform public.operator_update(rid,'reschedule','Perubahan jadwal karena pasokan material terlambat.',0,null,today+5,'high',null);
 if not exists(select 1 from public.report_updates where report_id=rid and previous_target=today+3 and new_target=today+5)then raise exception 'Schedule history lost';end if;
 update public.reports set last_update_at=now()-interval '1 day' where id=rid;
 select * into snap from public.reports where id=rid;
 perform public.operator_update(rid,'priority','Tingkat urgensi diubah menjadi Darurat melalui Peta Kendali.',99,today+1,today+9,'urgent',null);
 if not exists(
  select 1 from public.reports r
  where r.id=rid
   and r.priority='urgent'
   and r.support_count=snap.support_count
   and r.status=snap.status
   and r.progress=snap.progress
   and r.start_date is not distinct from snap.start_date
   and r.target_date is not distinct from snap.target_date
   and r.last_update_at is not distinct from snap.last_update_at
 )then raise exception 'Priority update mutated other report fields';end if;
 if not exists(select 1 from public.report_updates where report_id=rid and kind='priority' and previous_target is null and new_target is null)then raise exception 'Priority audit entry missing or altered target dates';end if;
 denied:=false;begin perform public.operator_update(rid,'finish','Perbaikan selesai tanpa foto bukti.',0,null,null,'high',null);exception when others then denied:=true;end;
 if not denied then raise exception 'Finish without photo allowed';end if;
 perform public.operator_update(rid,'finish','Perbaikan jalan telah diselesaikan dengan bukti.',0,null,null,'high','10000000-0000-4000-8000-000000000002/10000000-0000-4000-8000-000000000002.jpg');
 denied:=false;begin perform public.confirm_report(rid,true,'');exception when others then denied:=true;end;
 if not denied then raise exception 'Non-primary confirmation allowed';end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);
 perform public.confirm_report(rid,true,'');
 select sum(amount)into balance from public.point_ledger where user_id='10000000-0000-4000-8000-000000000001';
 if balance<>100 then raise exception 'Primary reward incorrect';end if;
 select sum(amount)into balance from public.point_ledger where user_id='10000000-0000-4000-8000-000000000002';
 if balance<>20 then raise exception 'Secondary reward incorrect';end if;
 denied:=false;begin perform public.confirm_report(rid,true,'');exception when others then denied:=true;end;
 if not denied then raise exception 'Double confirmation allowed';end if;
 denied:=false;begin perform public.redeem_voucher((select id from public.vouchers order by cost limit 1));exception when others then denied:=true;end;
 if not denied then raise exception 'Overspending allowed';end if;
 insert into public.point_ledger(user_id,amount,reason)values('10000000-0000-4000-8000-000000000001',200,'Fixture credit');
 redeemed_code:=public.redeem_voucher((select id from public.vouchers order by cost limit 1));
 if redeemed_code is null or not exists(select 1 from public.redemptions where redemptions.code=redeemed_code)then raise exception 'Redemption failed';end if;
end;$$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.submissions where user_id<>auth.uid())then raise exception 'RLS exposed another user submission';end if;
 if exists(select 1 from public.point_ledger where user_id<>auth.uid())then raise exception 'RLS exposed another user points';end if;
 if exists(select 1 from public.redemptions where user_id<>auth.uid())then raise exception 'RLS exposed another user voucher';end if;
end;$$;
reset role;
rollback;
select 'PASS: private photos, RPC permissions, deduplication, role restrictions, schedule history, priority isolation, evidence, confirmation, rewards and redemption' as integration_result;
