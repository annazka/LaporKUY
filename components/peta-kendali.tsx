'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import {watchMapTiles} from '@/lib/map-tiles.mjs';
import {ReportImage} from './report-image';

export interface ReportItem {
  id: string;
  title: string;
  description?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  photo_path?: string | null;
  status: string;
  priority: string;
  progress: number;
  support_count?: number | null;
  target_date?: string | null;
  [key: string]: any;
}

const FALLBACK_REPORTS: ReportItem[] = [
  {
    id: 'C0CD9DCD',
    title: 'jalanan rusak',
    description: 'jalanan rusak',
    address: 'pasar pondok labu',
    latitude: -6.3125,
    longitude: 106.7942,
    photo_path: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=900&q=80',
    status: 'in_progress',
    priority: 'medium',
    progress: 99,
    support_count: 3,
    target_date: '2026-11-26',
  },
];

export function getUrgency(report: any) {
  if (report?.status === 'completed') {
    return {
      key: 'completed' as const,
      label: 'Sudah selesai',
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.16)',
      border: 'rgba(100, 116, 139, 0.45)',
      pulse: false,
    };
  }

  const isOverdue =
    report?.target_date &&
    new Date(report.target_date) < new Date() &&
    report?.status !== 'completed';

  if (
    report?.priority === 'urgent' ||
    report?.priority === 'high' ||
    isOverdue ||
    (report?.support_count ?? 0) >= 5
  ) {
    return {
      key: 'urgent' as const,
      label: 'Sangat Darurat',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.16)',
      border: 'rgba(239, 68, 68, 0.45)',
      pulse: true,
    };
  }

  if (report?.priority === 'medium' || report?.status === 'in_progress') {
    return {
      key: 'medium' as const,
      label: 'Sedang',
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.16)',
      border: 'rgba(234, 179, 8, 0.45)',
      pulse: false,
    };
  }

  return {
    key: 'low' as const,
    label: 'Rendah',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(16, 185, 129, 0.45)',
    pulse: false,
  };
}

function formatStatusLabel(status: string) {
  const map: Record<string, string> = {
    submitted: 'Verifikasi baru',
    verified: 'Terverifikasi',
    scheduled: 'Terjadwal',
    in_progress: 'Dalam perbaikan',
    awaiting_confirmation: 'Menunggu konfirmasi',
    completed: 'Sudah selesai',
    rejected: 'Ditolak',
  };
  return map[status] || status;
}

export function PetaKendali({
  reports = [],
  onManageReport,
}: {
  reports?: any[];
  onManageReport?: (report: any) => void;
}) {
  const dataList: ReportItem[] =
    Array.isArray(reports) && reports.length > 0 ? reports : FALLBACK_REPORTS;

  const [items, setItems] = useState<ReportItem[]>(dataList);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'medium' | 'low' | 'new' | 'completed'>('all');
  const [selectedId, setSelectedId] = useState<string>(dataList[0]?.id || '');
  const [mapReady, setMapReady] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [mapError, setMapError] = useState('');
  const [tileState, setTileState] = useState({loading:true,error:''});

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (Array.isArray(reports) && reports.length > 0) {
      setItems(reports);
      setSelectedId((prev) => (reports.some((r) => r.id === prev) ? prev : reports[0].id));
    }
  }, [reports]);

  const filteredItems = items.filter((r) => {
    if (r.status === 'rejected') return false;
    const isDone = r.status === 'completed';
    if (filter === 'completed') return isDone;
    if (filter === 'all') return true;
    if (isDone) return false;
    if (filter === 'new') return r.status === 'submitted';
    return getUrgency(r).key === filter;
  });

  const selectedReport =
    filteredItems.find((r) => r.id === selectedId) ||
    filteredItems[0] ||
    null;

  const handlePriorityChange = (newPriority: 'urgent' | 'medium' | 'low') => {
    if (!selectedReport || selectedReport.status === 'completed') return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedReport.id
          ? {
              ...item,
              priority: newPriority,
              support_count:
                newPriority === 'urgent' ? Math.max(item.support_count || 0, 5) : 1,
            }
          : item
      )
    );
  };

  useEffect(() => {
    let isMounted = true;
    let observer: ResizeObserver | undefined;

    setMapError('');
    import('leaflet').then((mod) => {
      const L: any = mod.default || mod;
      if (!isMounted || !mapContainerRef.current) return;

      leafletRef.current = L;
      const instance = L.map(mapContainerRef.current, {
        center: [
          Number(selectedReport?.latitude) || -6.3125,
          Number(selectedReport?.longitude) || 106.7942,
        ],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = instance;

      markersLayerRef.current = L.layerGroup().addTo(instance);

      observer = new ResizeObserver(() => {
        if (isMounted) instance.invalidateSize({ animate: false });
      });
      observer.observe(mapContainerRef.current);

      setMapReady(true);
    }).catch(() => {
      if (isMounted) setMapError('Peta belum dapat dimuat. Data laporan tetap tersedia.');
    });

    return () => {
      isMounted = false;
      observer?.disconnect();
      mapInstanceRef.current?.stop?.();
      mapInstanceRef.current?.remove?.();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      setMapReady(false);
    };
  }, [mapAttempt]);

  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstanceRef.current) return;
    const layer = leafletRef.current.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      className: 'lk-map-tiles',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    });
    const stop = watchMapTiles(layer, setTileState);
    layer.addTo(mapInstanceRef.current);
    return () => { stop(); layer.remove(); };
  }, [mapReady, tileAttempt]);

  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapInstanceRef.current || !markersLayerRef.current) {
      return;
    }

    const L = leafletRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const validPoints: [number, number][] = [];

    filteredItems.forEach((rep) => {
      const lat = Number(rep.latitude);
      const lng = Number(rep.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      validPoints.push([lat, lng]);
      const u = getUrgency(rep);
      const isSelected = selectedReport?.id === rep.id;

      const icon = L.divIcon({
        className: '',
        html: `
          <div class="lk-pin ${u.pulse ? 'lk-pin-pulse' : ''}" style="
            width: ${isSelected ? '24px' : '18px'};
            height: ${isSelected ? '24px' : '18px'};
            background: ${u.color};
            border: 3px solid #ffffff;
            box-shadow: 0 0 0 3px #0a0a0a, 0 0 14px ${u.color};
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon, title: rep.title });
      marker.on('click', () => {
        setSelectedId(rep.id);
      });
      marker.addTo(layer);
    });

    if (selectedReport && Number.isFinite(Number(selectedReport.latitude)) && Number.isFinite(Number(selectedReport.longitude))) {
      mapInstanceRef.current.panTo([Number(selectedReport.latitude), Number(selectedReport.longitude)]);
    } else if (validPoints.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(validPoints), { padding: [35, 35], maxZoom: 14 });
    }
  }, [mapReady, filteredItems, selectedReport]);

  const activeUrgency = selectedReport ? getUrgency(selectedReport) : null;
  const isCompletedReport = selectedReport?.status === 'completed';

  return (
    <div style={{ color: '#e5e5e5', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`
        @keyframes lkUrgentRadar {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.85), 0 0 0 3px #0a0a0a; }
          70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0), 0 0 0 3px #0a0a0a; }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 0 0 3px #0a0a0a; }
        }
        .lk-map-tiles { filter: grayscale(1) invert(0.92) contrast(0.88); }
        .lk-pin { border-radius: 50%; cursor: pointer; transition: transform 0.2s ease; }
        .lk-pin:hover { transform: scale(1.25); }
        .lk-pin-pulse { animation: lkUrgentRadar 1.4s infinite; }
        .lk-filter-btn {
          background: #121212; color: #a3a3a3; border: 1px solid #262626;
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600;
          cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
        }
        .lk-filter-btn.active { background: #1f1f1f; color: #ffffff; border-color: #525252; }
        .lk-map-grid { display: grid; grid-template-columns: 1.65fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .lk-map-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button className={`lk-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          Semua titik
        </button>
        <button className={`lk-filter-btn ${filter === 'urgent' ? 'active' : ''}`} onClick={() => setFilter('urgent')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          Sangat Darurat
        </button>
        <button className={`lk-filter-btn ${filter === 'medium' ? 'active' : ''}`} onClick={() => setFilter('medium')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
          Sedang
        </button>
        <button className={`lk-filter-btn ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
          Rendah
        </button>
        <button className={`lk-filter-btn ${filter === 'new' ? 'active' : ''}`} onClick={() => setFilter('new')}>
          Verifikasi baru
        </button>
        <button className={`lk-filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
          Sudah selesai
        </button>
      </div>

      <div className="lk-map-grid">
        <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
          <div ref={mapContainerRef} role="region" aria-label="Peta kendali laporan Jakarta" style={{ height: '540px', width: '100%' }} />
          {(mapError || tileState.error || tileState.loading) && (
            <div role={mapError || tileState.error ? 'alert' : 'status'} style={{position:'absolute',top:14,left:14,right:14,zIndex:500,background:'#171717',border:'1px solid #404040',borderRadius:10,padding:12,fontSize:14}}>
              <p style={{margin:0}}>{mapError || tileState.error || 'Memuat peta…'}</p>
              {(mapError || tileState.error) && <button type="button" className="lk-filter-btn" style={{marginTop:8,fontSize:14}} onClick={() => mapError ? setMapAttempt(value => value + 1) : setTileAttempt(value => value + 1)}>Coba lagi</button>}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              zIndex: 500,
              background: 'rgba(10, 10, 10, 0.88)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #262626',
              borderRadius: '10px',
              padding: '8px 12px',
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              fontSize: '11px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              Merah: Sangat Darurat
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
              Kuning: Sedang
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Hijau: Rendah
            </span>
          </div>
        </div>

        {selectedReport && activeUrgency ? (
          <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '16px', padding: '22px' }}>
            <div style={{ fontSize: '11px', color: '#8a8a8a', fontFamily: 'monospace', marginBottom: '10px' }}>
              #{String(selectedReport.id).slice(0, 8).toUpperCase()}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={{ background: '#1e293b', color: '#93c5fd', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                {formatStatusLabel(selectedReport.status)}
              </span>
              {!isCompletedReport && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: activeUrgency.bg, color: activeUrgency.color, border: `1px solid ${activeUrgency.border}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeUrgency.color }} />
                  {activeUrgency.label}
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>{selectedReport.title}</h3>
            <p style={{ fontSize: '13px', color: '#a3a3a3', margin: '0 0 16px 0' }}>{selectedReport.address}</p>

            <div
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
                height: '190px',
                background: '#1a1a1a',
                marginBottom: '16px',
              }}
            >
              <ReportImage report={selectedReport} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>

            {!isCompletedReport && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Ubah Tingkat Urgensi:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button type="button" onClick={() => handlePriorityChange('urgent')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'urgent' ? 'rgba(239,68,68,0.2)' : '#1a1a1a', color: '#f87171', border: activeUrgency.key === 'urgent' ? '1px solid #ef4444' : '1px solid #262626' }}>🔴 Darurat</button>
                  <button type="button" onClick={() => handlePriorityChange('medium')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'medium' ? 'rgba(234,179,8,0.2)' : '#1a1a1a', color: '#facc15', border: activeUrgency.key === 'medium' ? '1px solid #eab308' : '1px solid #262626' }}>🟡 Sedang</button>
                  <button type="button" onClick={() => handlePriorityChange('low')} style={{ padding: '6px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: activeUrgency.key === 'low' ? 'rgba(16,185,129,0.2)' : '#1a1a1a', color: '#34d399', border: activeUrgency.key === 'low' ? '1px solid #10b981' : '1px solid #262626' }}>🟢 Rendah</button>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a3a3a3' }}>Progres</span>
                <strong style={{ color: '#ffffff' }}>{selectedReport.progress ?? 0}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a3a3a3' }}>Target</span>
                <strong style={{ color: '#ffffff' }}>{selectedReport.target_date || '26 Nov 2026'}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onManageReport?.(selectedReport)}
              style={{ width: '100%', background: '#f5f5f5', color: '#0a0a0a', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              Kelola laporan
            </button>
          </div>
        ) : (
          <div style={{ background: '#121212', border: '1px solid #262626', borderRadius: '16px', padding: '22px', color: '#a3a3a3', fontSize: '13px' }}>
            Tidak ada titik untuk filter ini.
          </div>
        )}
      </div>
    </div>
  );
}

export default PetaKendali;
