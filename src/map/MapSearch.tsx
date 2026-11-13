import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, ExternalLink, Globe, Search, X } from 'lucide-react';
import type { MapLocation } from '../data/tripData';
import type { LatLng } from '../data/seoulMetro';
import { geocodeMapAddress, type GeocodeHit } from '../utils/geocode';
import { categoryIconSvg } from '../components/map/categoryIcons';
import { mobileCategoryColor } from '../components/map/categoryStyle';
import { formatMeters } from './geo';
import { kakaoSearchUrl, kindLabel, naverSearchUrl, recentSearches, rememberSearch, searchLocal, type SearchItem } from './searchIndex';
import { searchKoreanMapPlaces } from './mapSearchService';
import { parseSharedText } from '../shared/places';
import { dedupeMapSearchHits, type MapSearchPrecision, type MapSearchSource, type RemoteMapSearchHit } from '../shared/mapSearch';

/**
 * Ricerca mobile: risultati locali offline e, su richiesta, geocoder coreani con fallback OpenStreetMap.
 */
export const OSM_ID_PREFIX = 'osm:';

type DisplayHit = { loc: MapLocation; source: MapSearchSource; precision: MapSearchPrecision; address: string; searchHit: RemoteMapSearchHit };

const sourceName: Record<MapSearchSource, string> = {
  naver: 'Naver', kakao: 'Kakao', openstreetmap: 'OpenStreetMap', coordinates: 'Coordinate'
};

const precisionName: Record<MapSearchPrecision, string> = {
  place: 'Luogo', address: 'Indirizzo · verifica il pin', street: 'Via', area: 'Zona approssimata', unknown: 'Precisione non indicata'
};

function cityForPoint(lat: number, lng: number): MapLocation['city'] {
  if (lat >= 37.40 && lat <= 37.72 && lng >= 126.76 && lng <= 127.19) return 'Seul';
  if (lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132) return 'Dintorni / Gite';
  if (lat >= 39.4 && lat <= 41.1 && lng >= 115.7 && lng <= 117.5) return 'Pechino';
  if (lat >= 44.9 && lat <= 45.7 && lng >= 8.8 && lng <= 9.5) return 'Milano';
  return 'Altrove';
}

export function resultToLocation(hit: RemoteMapSearchHit): MapLocation {
  return {
    id: `${OSM_ID_PREFIX}${hit.source}:${hit.id}`,
    name: hit.title,
    italianName: hit.title,
    district: hit.address || sourceName[hit.source],
    city: cityForPoint(hit.lat, hit.lng),
    category: 'luogo',
    lat: hit.lat,
    lng: hit.lng,
    dayNumbers: [],
    description: hit.precision === 'address'
      ? `Indirizzo trovato da ${sourceName[hit.source]}. Il pin indica il punto geocodificato dell’indirizzo, non garantisce l’ingresso dell’edificio.`
      : hit.precision === 'area' || hit.precision === 'street'
        ? `Risultato di ${sourceName[hit.source]} riferito a una via o zona: controlla la posizione prima di usarla.`
        : `Risultato di ${sourceName[hit.source]}. Controlla il pin sulla mappa.`
  };
}

function osmDisplayHit(hit: GeocodeHit): DisplayHit {
  const [title, ...rest] = hit.label.split(',');
  const precision = hit.precision ?? (hit.precise ? 'place' : 'area');
  const loc = resultToLocation({
    id: `${hit.lat.toFixed(6)},${hit.lng.toFixed(6)}`,
    title: title.trim(),
    address: rest.slice(0, 3).map((part) => part.trim()).filter(Boolean).join(', ') || 'OpenStreetMap',
    lat: hit.lat, lng: hit.lng, source: 'openstreetmap', precision
  });
  const searchHit: RemoteMapSearchHit = {
    id: `${hit.lat.toFixed(6)},${hit.lng.toFixed(6)}`,
    title: title.trim(),
    address: loc.district,
    lat: hit.lat,
    lng: hit.lng,
    source: 'openstreetmap',
    precision
  };
  return { loc, source: 'openstreetmap', precision, address: loc.district, searchHit };
}

function isAddressLike(query: string) {
  const normalized = query.normalize('NFKC').replace(/[‐‑‒–—]/g, '-').trim();
  // "-ro", "-gil" e anche "-daero" (Sejong-daero), "-daegil"
  return /(?:^|\b)\d+(?:-\d+)?\s+.+-[a-z]*(?:ro|gil)\b/i.test(normalized);
}

function zoomForPrecision(precision: MapSearchPrecision) {
  if (precision === 'address' || precision === 'place') return 18;
  if (precision === 'street') return 16;
  return 14;
}

function coordinateResult(query: string): DisplayHit | null {
  const parsed = parseSharedText(query);
  if (parsed.lat === null || parsed.lng === null) return null;
  const loc = resultToLocation({
    id: `${parsed.lat.toFixed(6)},${parsed.lng.toFixed(6)}`,
    title: parsed.name || 'Punto condiviso',
    address: `${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`,
    lat: parsed.lat, lng: parsed.lng, source: 'coordinates', precision: 'place'
  });
  const searchHit: RemoteMapSearchHit = {
    id: `${parsed.lat.toFixed(6)},${parsed.lng.toFixed(6)}`,
    title: loc.italianName,
    address: loc.district,
    lat: parsed.lat,
    lng: parsed.lng,
    source: 'coordinates',
    precision: 'place'
  };
  return { loc, source: 'coordinates', precision: 'place', address: loc.district, searchHit };
}

interface Props {
  items: SearchItem[];
  here: LatLng | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (loc: MapLocation, zoom?: number) => void;
  /** Altezza dello spazio sotto la barra (il pannello la occupa tutta) */
  panelHeight: number;
}

const row = 'w-full flex items-center gap-3 px-4 min-h-[56px] text-left border-t border-[rgba(234,240,246,.11)] first:border-t-0 active:bg-[rgba(234,240,246,.05)]';

export const MapSearch: React.FC<Props> = ({ items, here, open, onOpen, onClose, onPick, panelHeight }) => {
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<{ q: string; hits: DisplayHit[] | null; error: string | null; loading: boolean }>({ q: '', hits: null, error: null, loading: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchRunRef = useRef(0);

  const local = useMemo(() => searchLocal(items, q, here), [items, q, here]);
  const recent = useMemo(() => (open && q.trim() === '' ? recentSearches() : []), [open, q]);

  useEffect(() => {
    if (!open) {
      setQ('');
      searchRunRef.current += 1;
      setRemote({ q: '', hits: null, error: null, loading: false });
      abortRef.current?.abort();
    }
  }, [open]);

  const pick = (loc: MapLocation, zoom = 16, remember = true) => {
    const parsed = parseSharedText(q);
    if (remember && !isAddressLike(q) && !parsed.url && parsed.lat === null) rememberSearch(q.trim() || loc.italianName);
    onPick(loc, zoom);
    onClose();
  };

  const searchOnline = async () => {
    const text = q.trim();
    if (text.length < 3) return;
    const run = ++searchRunRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRemote({ q: text, hits: null, error: null, loading: true });

    const coordinates = coordinateResult(text);
    if (coordinates) {
      setRemote({ q: text, hits: [coordinates], error: null, loading: false });
      return;
    }

    const [korean, osm] = await Promise.allSettled([
      searchKoreanMapPlaces(text),
      geocodeMapAddress(text, ctrl.signal)
    ]);
    if (ctrl.signal.aborted || searchRunRef.current !== run) return;

    const koreanHits: DisplayHit[] = korean.status === 'fulfilled'
      ? korean.value.hits.map((hit) => {
          const loc = resultToLocation(hit);
          return { loc, source: hit.source, precision: hit.precision, address: hit.address, searchHit: hit };
        })
      : [];
    const osmHits: DisplayHit[] = osm.status === 'fulfilled' ? osm.value.map(osmDisplayHit) : [];
    const allHits = [...koreanHits, ...osmHits];
    const displayByHit = new Map(allHits.map((hit) => [`${hit.source}:${hit.searchHit.id}`, hit]));
    const hits = dedupeMapSearchHits(allHits.map((hit) => hit.searchHit))
      .map((hit) => displayByHit.get(`${hit.source}:${hit.id}`))
      .filter((hit): hit is DisplayHit => Boolean(hit))
      .slice(0, 10);
    const failures = korean.status === 'rejected' && osm.status === 'rejected';
    setRemote({
      q: text,
      hits,
      error: failures ? 'Non riesco a contattare i servizi di ricerca. Controlla la connessione e riprova.' : null,
      loading: false
    });
  };

  const trimmed = q.trim();
  const showRemote = remote.q === trimmed && trimmed.length >= 3;

  return (
    <>
      <div className="pointer-events-auto h-12 rounded-xl bg-[#152231] flex items-center gap-2.5 pl-3.5 pr-1.5 focus-within:shadow-[inset_0_0_0_1.5px_#52d9e6]">
        {open ? (
          <button type="button" onClick={onClose} aria-label="Chiudi la ricerca" className="w-9 h-11 -ml-2 flex items-center justify-center text-[#eaf0f6] active:opacity-70">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Search className="w-[22px] h-[22px] text-[#97a5b9] shrink-0" strokeWidth={1.6} />
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const shared = parseSharedText(trimmed);
              if (isAddressLike(trimmed) || local.length === 0 || shared.lat !== null) void searchOnline();
              else pick(local[0].item.loc);
            }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Cerca luoghi, indirizzi, stazioni…"
          aria-label="Cerca sulla mappa"
          data-testid="map-search"
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[#eaf0f6] placeholder:text-[#97a5b9] focus:outline-none"
        />
        {q !== '' && (
          <button type="button" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Cancella il testo" className="w-11 h-11 flex items-center justify-center text-[#97a5b9] active:opacity-70">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Risultati della ricerca"
          className="pointer-events-auto mt-2 rounded-xl bg-[#0a1119] overflow-y-auto overscroll-contain"
          style={{ height: panelHeight }}
          data-testid="map-search-panel"
        >
          {trimmed.length < 2 ? (
            recent.length > 0 ? (
              <div>
                <p className="px-4 pt-3 pb-1 text-[13px] text-[#97a5b9]">Ricerche recenti</p>
                {recent.map((r) => (
                  <button key={r} type="button" className={row} onClick={() => { setQ(r); inputRef.current?.focus(); }}>
                    <Clock className="w-5 h-5 text-[#97a5b9] shrink-0" />
                    <span className="text-[15px] text-[#eaf0f6] truncate">{r}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-[14px] text-[#97a5b9] leading-relaxed">
                Scrivi il nome di una tappa, di un luogo salvato, di una stazione o di un quartiere. Funziona anche senza rete.
              </p>
            )
          ) : (
            <>
              {local.map(({ item, meters }) => (
                <button key={item.loc.id} type="button" role="option" aria-selected={false} className={row} onClick={() => pick(item.loc)}>
                  <span
                    aria-hidden="true"
                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: '#0d1824', boxShadow: `inset 0 0 0 2px ${mobileCategoryColor(item.loc.category)}` }}
                    dangerouslySetInnerHTML={{ __html: categoryIconSvg(item.loc.category, 16) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-[#eaf0f6] truncate">{item.loc.italianName}</span>
                    <span className="block text-[13px] text-[#97a5b9] truncate">
                      {kindLabel(item.kind)} · {item.loc.district}
                    </span>
                  </span>
                  {meters !== null && <span className="text-[13px] text-[#97a5b9] tabular-nums shrink-0">{formatMeters(meters)}</span>}
                </button>
              ))}
              {local.length === 0 && (
                <p className="px-4 py-4 text-[14px] text-[#97a5b9]">Nessun posto nostro per “{trimmed}”.</p>
              )}

              <p className="px-4 pt-4 pb-1 text-[13px] text-[#97a5b9] border-t border-[rgba(234,240,246,.11)]">Altrove, con la rete</p>
              {!showRemote ? (
                <button type="button" className={row} onClick={() => void searchOnline()} disabled={trimmed.length < 3} data-testid="map-search-online">
                  <Globe className="w-5 h-5 text-[#52d9e6] shrink-0" />
                  <span className="text-[15px] font-semibold text-[#52d9e6]">Cerca indirizzo o luogo online</span>
                </button>
              ) : remote.loading ? (
                <p className="px-4 py-4 text-[14px] text-[#97a5b9]" role="status">Cerco indirizzo e luogo…</p>
              ) : remote.error ? (
                <p className="px-4 py-4 text-[14px] text-[#fbbf24] leading-snug" role="alert">{remote.error}</p>
              ) : remote.hits && remote.hits.length === 0 ? (
                <p className="px-4 py-4 text-[14px] text-[#97a5b9]">Nessuna corrispondenza precisa per “{trimmed}”. Prova ad aggiungere quartiere e città.</p>
              ) : (
                remote.hits?.map(({ loc, source, precision, address }) => {
                  return (
                    <button key={loc.id} type="button" role="option" aria-selected={false} className={row} onClick={() => pick(loc, zoomForPrecision(precision), source !== 'coordinates')}>
                      <span
                        aria-hidden="true"
                        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                        style={{ background: '#0d1824', boxShadow: `inset 0 0 0 2px ${mobileCategoryColor(loc.category)}` }}
                        dangerouslySetInnerHTML={{ __html: categoryIconSvg(loc.category, 16) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-[#eaf0f6] truncate">{loc.italianName}</span>
                        <span className="block text-[13px] text-[#97a5b9] truncate" title={address}>
                          {sourceName[source]} · {precisionName[precision]} · {address}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
              <a href={naverSearchUrl(trimmed)} target="_blank" rel="noopener noreferrer" className={row} onClick={() => rememberSearch(trimmed)}>
                <ExternalLink className="w-5 h-5 text-[#97a5b9] shrink-0" />
                <span className="text-[15px] text-[#eaf0f6]">Cerca “{trimmed}” su Naver Map</span>
              </a>
              <a href={kakaoSearchUrl(trimmed)} target="_blank" rel="noopener noreferrer" className={row} onClick={() => rememberSearch(trimmed)}>
                <ExternalLink className="w-5 h-5 text-[#97a5b9] shrink-0" />
                <span className="text-[15px] text-[#eaf0f6]">Cerca “{trimmed}” su Kakao Map</span>
              </a>
              <div className="h-6" />
            </>
          )}
        </div>
      )}
    </>
  );
};
