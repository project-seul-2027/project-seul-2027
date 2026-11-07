import React, { useMemo, useState } from 'react';
import { Camera, Heart, MessageCircle, ImageOff, Upload, SlidersHorizontal, MapPin } from 'lucide-react';
import type { GalleryPhoto } from '../../types/gallery';
import { ITINERARY_DAYS } from '../../data/tripData';

/**
 * Galleria sul telefono: foto raggruppate per giorno in una griglia a 3 colonne.
 * Ogni riquadro ha la sua misura (quadrato) prima che l'immagine arrivi, quindi la pagina
 * non si sposta durante il caricamento. Un tocco apre il dettaglio (like, commenti, mappa).
 */

/** Miniatura con riquadro riservato: tinta tenue + bordo tratteggiato finché l'immagine non c'è */
const Thumb: React.FC<{ photo: GalleryPhoto; onOpen: () => void; mine: boolean; liked: boolean }> = ({ photo, onOpen, mine, liked }) => {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="phone-thumb"
      aria-label={`Foto${photo.locationName ? ` a ${photo.locationName}` : ''} di ${photo.uploaderName}${photo.likes.length ? `, ${photo.likes.length} mi piace` : ''}`}
      className={`relative aspect-square overflow-hidden rounded-xl bg-app-surface ${state === 'ok' ? 'border border-app-line' : 'border border-dashed border-app-control/60'} focus-visible:outline-2 focus-visible:outline-app-accent`}
    >
      {state !== 'failed' ? (
        <img
          src={photo.thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('failed')}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] text-app-muted">
          <ImageOff className="w-5 h-5" /> Non disponibile
        </span>
      )}
      {state === 'ok' && (photo.likes.length > 0 || photo.comments.length > 0) && (
        <span className="absolute left-1 bottom-1 flex items-center gap-1.5 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {photo.likes.length > 0 && (
            <span className="flex items-center gap-0.5"><Heart className={`w-3 h-3 ${liked ? 'fill-fam-gallery text-fam-gallery' : 'text-fam-gallery'}`} />{photo.likes.length}</span>
          )}
          {photo.comments.length > 0 && <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{photo.comments.length}</span>}
        </span>
      )}
      {mine && state === 'ok' && <span className="absolute right-1 top-1 rounded-md bg-black/70 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Tu</span>}
    </button>
  );
};

/** Griglia di riquadri vuoti mostrata mentre la galleria si carica: stessa misura della griglia vera */
export const PhoneGallerySkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Carico le foto del gruppo" data-testid="phone-gallery-skeleton">
    {/* Stessa altezza della riga dei filtri che compare a caricamento finito */}
    <div className="h-10 rounded-full bg-app-surface/60" />
    {[0, 1].map((g) => (
      <div key={g} className="space-y-2" data-skel-group={g}>
        <div className="h-[22px] flex items-center"><div className="h-3.5 w-40 rounded bg-app-surface" /></div>
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: g === 0 ? 6 : 3 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-app-surface border border-dashed border-app-control/40" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export type QuickFilter = 'all' | 'today' | 'mine' | 'liked';

interface ChipsProps {
  value: QuickFilter;
  onChange: (v: QuickFilter) => void;
  showToday: boolean;
  todayDay: number | null;
  onToggleFilters: () => void;
  filtersOpen: boolean;
  activeExtra: number;
}

/** Filtri rapidi. «Oggi» = foto del giorno di viaggio in corso, non quelle caricate oggi. */
export const PhoneGalleryChips: React.FC<ChipsProps> = ({ value, onChange, showToday, todayDay, onToggleFilters, filtersOpen, activeExtra }) => {
  const chips: { id: QuickFilter; label: string }[] = [
    { id: 'all', label: 'Tutte' },
    ...(showToday ? [{ id: 'today' as const, label: todayDay !== null ? `Oggi · giorno ${todayDay}` : 'Oggi' }] : []),
    { id: 'mine', label: 'Le mie' },
    { id: 'liked', label: 'Preferite' }
  ];
  return (
    <div className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto scrollbar-none" role="group" aria-label="Filtri foto">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          data-testid={`gal-chip-${c.id}`}
          className={`min-h-[40px] px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border ${
            value === c.id ? 'bg-app-accent text-app-on-accent border-app-accent' : 'bg-app-surface text-slate-200 border-app-control'
          }`}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        data-testid="gal-more-filters"
        className={`min-h-[40px] px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border flex items-center gap-1.5 ${
          filtersOpen || activeExtra > 0 ? 'border-0 text-app-accent bg-app-accent/10' : 'bg-[var(--ms-fill)] text-[#eaf0f6] border-0'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" /> Filtri{activeExtra > 0 ? ` (${activeExtra})` : ''}
      </button>
    </div>
  );
};

interface GridProps {
  photos: GalleryPhoto[];
  currentUserId: string;
  isMine: (p: GalleryPhoto) => boolean;
  onOpen: (p: GalleryPhoto) => void;
}

/** Ordine della griglia (giorni più recenti prima): serve anche per scorrere tra le foto nel dettaglio */
export function phoneOrder(photos: GalleryPhoto[]): GalleryPhoto[] {
  const key = (p: GalleryPhoto) => (p.dayNumber === undefined ? -1 : p.dayNumber);
  return photos.map((p, i) => ({ p, i })).sort((a, b) => key(b.p) - key(a.p) || a.i - b.i).map((x) => x.p);
}

export const PhoneGalleryGrid: React.FC<GridProps> = ({ photos, currentUserId, isMine, onOpen }) => {
  const groups = useMemo(() => {
    const by = new Map<number | 'none', GalleryPhoto[]>();
    for (const p of photos) {
      const k = p.dayNumber ?? 'none';
      by.set(k, [...(by.get(k) ?? []), p]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : (b as number) - (a as number)))
      .map(([k, list]) => ({ key: k, list }));
  }, [photos]);

  return (
    <div className="space-y-5" data-testid="phone-gallery">
      {groups.map(({ key, list }) => {
        const day = key === 'none' ? null : ITINERARY_DAYS.find((d) => d.id === key);
        return (
          <section key={String(key)} className="space-y-2" aria-label={day ? `Giorno ${day.id}` : 'Senza giorno'}>
            <div className="flex h-[22px] items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold text-app-text flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-fam-gallery" />
                {day ? (day.id === 0 ? `Partenza · ${day.dateStr.replace(' 2027', '')}` : `Giorno ${day.id} · ${day.dateStr.replace(' 2027', '')}`) : 'Senza giorno'}
              </h3>
              <span className="text-[11px] font-mono text-app-muted">{list.length} foto</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {list.map((p) => (
                <Thumb key={p.id} photo={p} onOpen={() => onOpen(p)} mine={isMine(p)} liked={p.likes.includes(currentUserId)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

/** Intestazione compatta: titolo già nella barra in alto, qui solo azioni e un riepilogo di una riga */
export const PhoneGalleryHeader: React.FC<{
  onUpload: () => void;
  onCamera: () => void;
  stats: { totalPhotos: number; uniquePlaces: number; totalLikes: number; coveredDays: number };
  totalDays: number;
  loaded: boolean;
}> = ({ onUpload, onCamera, stats, totalDays, loaded }) => (
  <div className="space-y-3" data-testid="phone-gallery-header">
    <div className="grid grid-cols-2 gap-2.5">
      <button type="button" onClick={onCamera} data-testid="gal-camera" className="min-h-[52px] rounded-2xl bg-app-accent text-app-on-accent text-[15px] font-bold flex items-center justify-center gap-2">
        <Camera className="w-5 h-5" /> Scatta foto
      </button>
      <button type="button" onClick={onUpload} data-testid="gal-upload" className="min-h-[52px] rounded-2xl bg-app-raised border border-app-control text-app-text text-[15px] font-semibold flex items-center justify-center gap-2">
        <Upload className="w-5 h-5" /> Dalla galleria
      </button>
    </div>
    <p className={`text-[13px] text-app-muted font-mono flex flex-wrap gap-x-3 gap-y-0.5 ${loaded ? '' : 'invisible'}`} aria-hidden={!loaded}>
      <span><b className="text-app-text">{stats.totalPhotos}</b> foto</span>
      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /><b className="text-app-text">{stats.uniquePlaces}</b> luoghi</span>
      <span><b className="text-app-text">{stats.coveredDays}</b>/{totalDays} giorni</span>
      <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-fam-gallery" /><b className="text-app-text">{stats.totalLikes}</b></span>
    </p>
  </div>
);
