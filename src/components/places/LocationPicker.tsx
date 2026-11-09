import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

/**
 * Mini mappa per controllare e correggere la posizione di un posto: si trascina il segnaposto
 * oppure si tocca il punto giusto. Stesse mappe del resto del sito, così si riconoscono i nomi dei locali.
 */
const RETINA = typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1.25 ? '&scale=2' : '';
const TILE_URL = `https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}${RETINA}`;

export const LocationPicker: React.FC<{ lat: number; lng: number; onChange: (lat: number, lng: number) => void }> = ({ lat, lng, onChange }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: false, tap: false } as L.MapOptions).setView([lat, lng], 17);
    L.tileLayer(TILE_URL, { maxZoom: 20, subdomains: ['0', '1', '2', '3'] }).addTo(m);
    const icon = L.divIcon({
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: '<div style="width:34px;height:34px;border-radius:11px;background:#7c3aed;border:3px solid #fff;box-shadow:0 3px 12px #000a;display:flex;align-items:center;justify-content:center;font-size:17px"></div>'
    });
    const mk = L.marker([lat, lng], { icon, draggable: true }).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLatLng();
      onChangeRef.current(p.lat, p.lng);
    });
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    marker.current = mk;
    window.setTimeout(() => m.invalidateSize(), 150);
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // la mappa si crea una volta sola: gli spostamenti successivi li gestisce l'effetto sotto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Posizione cambiata da fuori (nuovo risultato di ricerca, GPS…): segnaposto e vista la seguono
  useEffect(() => {
    const mk = marker.current;
    const m = map.current;
    if (!mk || !m) return;
    const cur = mk.getLatLng();
    if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
      mk.setLatLng([lat, lng]);
      m.setView([lat, lng], Math.max(m.getZoom(), 17));
    }
  }, [lat, lng]);

  return <div ref={box} className="h-56 w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-950" data-testid="place-picker" aria-label="Mappa per controllare la posizione del posto" />;
};
