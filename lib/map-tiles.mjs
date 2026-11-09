// Observe one tile layer without replacing report markers or the map instance.
export function watchMapTiles(layer, onState, timeout = 12000) {
 let disposed = false, timer, successes = 0, failures = 0;
 const publish = state => { if (!disposed) onState(state); };
 const fail = () => publish({loading:false,error:successes
  ? 'Sebagian peta belum termuat. Coba lagi.'
  : 'Peta belum dapat dimuat. Data laporan tetap tersedia.'});
 const loading = () => {
  if (disposed) return;
  successes = 0; failures = 0;
  clearTimeout(timer);
  publish({loading:true,error:''});
  timer = setTimeout(fail, timeout);
 };
 const tileload = () => { successes++; };
 const tileerror = () => { failures++; };
 const load = () => {
  clearTimeout(timer);
  if (failures || !successes) fail();
  else publish({loading:false,error:''});
 };
 const events = {loading,tileload,tileerror,load};
 layer.on(events);
 loading();
 return () => { disposed = true; clearTimeout(timer); layer.off(events); };
}
