import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, MoreHorizontal, Heart, MessageCircle, MapPin, CalendarDays, Download, Trash2, X, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { GalleryComment, GalleryPhoto } from '../../types/gallery';
import { ITINERARY_DAYS } from '../../data/tripData';

/**
 * Dettaglio foto sul telefono, impostato come un post di Instagram:
 * autore e luogo in alto, foto a tutta larghezza (doppio tocco = mi piace), riga di azioni,
 * "Piace a…", didascalia, commenti e campo per commentare fisso in basso.
 * Colori dell'app: rosa della Galleria per il cuore, ciano per le azioni.
 */

interface Props {
  photo: GalleryPhoto;
  fullImageUrl: string | null;
  fullImageFailed: boolean;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  mention: RegExp | null;
  commentText: string;
  commentMax: number;
  onCommentText: (v: string) => void;
  onSendComment: () => void;
  onDeleteComment: (id: string) => void;
  canDeleteComment: (c: GalleryComment) => boolean;
  isOwner: boolean;
  onToggleLike: () => void;
  onDelete: () => void;
  onMap: (() => void) | null;
  onDay: (() => void) | null;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

const Avatar: React.FC<{ name: string; url?: string; size?: string }> = ({ name, url, size = 'w-8 h-8' }) => (
  <span className={`${size} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-fam-gallery/20 text-fam-gallery text-[11px] font-bold ring-2 ring-fam-gallery/50 ring-offset-2 ring-offset-app-bg`}>
    {url ? <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
  </span>
);

const ago = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'ora';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} g`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

export const PhonePhotoViewer: React.FC<Props> = (p) => {
  const { photo } = p;
  const liked = photo.likes.includes(p.currentUserId);
  const [menu, setMenu] = useState(false);
  const [likers, setLikers] = useState(false);
  const [burst, setBurst] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastTap = useRef(0);
  const touchX = useRef<number | null>(null);
  const day = photo.dayNumber !== undefined ? ITINERARY_DAYS.find((d) => d.id === photo.dayNumber) : undefined;

  // Esc chiude (prima il menu), il tasto "indietro" chiude la foto, la pagina sotto non scorre
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  const onCloseRef = useRef(p.onClose);
  onCloseRef.current = p.onClose;
  useEffect(() => {
    let popped = false;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), seulPhoto: true }, '');
    } catch {
      /* niente */
    }
    const onPop = () => {
      popped = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && window.history.state?.seulPhoto) window.history.back();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (likers) setLikers(false);
      else if (menu) setMenu(false);
      else p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, likers, p]);
  useEffect(() => {
    setExpanded(false);
    setLikers(false);
  }, [photo.id]);

  // Doppio tocco sulla foto = mi piace (come Instagram); non toglie un like già messo
  const onImageTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) p.onToggleLike();
      setBurst((b) => b + 1);
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  const caption = (text: string) => {
    if (!text) return null;
    const parts = p.mention ? text.split(p.mention) : [text];
    return parts.map((part, i) => (p.mention && i % 2 === 1 ? <span key={i} className="font-semibold text-app-accent">{part}</span> : <span key={i}>{part}</span>));
  };

  const likeLine = (() => {
    const n = photo.likes.length;
    if (n === 0) return 'Nessun mi piace: tocca due volte la foto';
    const first = photo.likeNames[0] ?? '';
    return n === 1 ? <>Piace a <b className="text-app-text">{first}</b></> : <>Piace a <b className="text-app-text">{first}</b> e <b className="text-app-text">{n - 1 === 1 ? 'un\'altra persona' : `altre ${n - 1} persone`}</b></>;
  })();

  const comments = photo.comments;
  const visibleComments = expanded || comments.length <= 3 ? comments : comments.slice(-2);
  const ratio = photo.dimensions.width > 0 && photo.dimensions.height > 0 ? photo.dimensions.width / photo.dimensions.height : 1;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Foto di ${photo.uploaderName}`} className="fixed inset-0 z-[9999] bg-app-bg flex flex-col" data-testid="photo-viewer">
      {/* Barra superiore */}
      <header className="shrink-0 h-14 pt-[env(safe-area-inset-top)] box-content flex items-center gap-1 px-1.5 border-b border-app-line bg-app-bg">
        <button ref={closeRef} type="button" onClick={p.onClose} aria-label="Chiudi la foto" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-text focus-visible:outline-2 focus-visible:outline-app-accent" data-testid="pv-close">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="flex-1 text-center text-[15px] font-bold text-app-text">Galleria</span>
        <span className="w-11" aria-hidden />
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Autore + luogo */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={photo.uploaderName} url={photo.uploaderAvatar} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[14px] font-bold text-app-text truncate">{photo.uploaderName}</div>
            {photo.locationName && (
              p.onMap ? (
                <button type="button" onClick={p.onMap} className="text-[12px] text-slate-300 truncate max-w-full text-left" data-testid="pv-location">{photo.locationName}</button>
              ) : (
                <div className="text-[12px] text-slate-300 truncate">{photo.locationName}</div>
              )
            )}
          </div>
          <button type="button" onClick={() => setMenu(true)} aria-label="Altre opzioni" aria-haspopup="dialog" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-text" data-testid="pv-menu">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>

        {/* Foto: spazio riservato con le proporzioni vere, così nulla salta mentre arriva la versione piena */}
        <div
          className="relative w-full bg-black select-none"
          style={{ aspectRatio: String(Math.max(0.3, Math.min(4, ratio))), maxHeight: 'max(240px, calc(100dvh - 15rem))' }}
          onClick={onImageTap}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            if (start === null) return;
            const dx = e.changedTouches[0].clientX - start;
            if (dx < -60 && p.onNext) p.onNext();
            if (dx > 60 && p.onPrev) p.onPrev();
          }}
          data-testid="pv-image"
        >
          <img
            src={p.fullImageUrl ?? photo.thumbUrl}
            alt={photo.caption || photo.locationName || 'Foto del gruppo'}
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain transition-[filter] duration-300 ${p.fullImageUrl || p.fullImageFailed ? '' : 'blur-[2px]'}`}
          />
          {!p.fullImageUrl && !p.fullImageFailed && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="w-7 h-7 animate-spin text-white/70" /></span>
          )}
          {burst > 0 && (
            <span key={burst} aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="w-24 h-24 fill-fam-gallery text-fam-gallery drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] animate-like-burst" />
            </span>
          )}
          {p.onPrev && (
            <button type="button" onClick={(e) => { e.stopPropagation(); p.onPrev!(); }} aria-label="Foto precedente" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          )}
          {p.onNext && (
            <button type="button" onClick={(e) => { e.stopPropagation(); p.onNext!(); }} aria-label="Foto successiva" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
          )}
        </div>
        {p.fullImageFailed && <p className="px-3 pt-2 text-[11px] text-amber-300">Foto a piena qualità non disponibile: vedi l'anteprima.</p>}

        {/* Azioni */}
        <div className="flex items-center gap-1 px-1.5 pt-1">
          <button type="button" onClick={() => { p.onToggleLike(); if (!liked) setBurst((b) => b + 1); }} aria-pressed={liked} aria-label={liked ? 'Togli mi piace' : 'Mi piace'} className="w-11 h-11 rounded-xl flex items-center justify-center" data-testid="pv-like">
            <Heart className={`w-[26px] h-[26px] transition-transform active:scale-90 ${liked ? 'fill-fam-gallery text-fam-gallery' : 'text-app-text'}`} />
          </button>
          <button type="button" onClick={() => inputRef.current?.focus()} aria-label="Commenta" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-text">
            <MessageCircle className="w-[26px] h-[26px] -scale-x-100" />
          </button>
          {p.onMap && (
            <button type="button" onClick={p.onMap} aria-label="Vedi sulla mappa" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-text">
              <MapPin className="w-[26px] h-[26px]" />
            </button>
          )}
          <span className="flex-1" />
          {p.fullImageUrl && (
            <a href={p.fullImageUrl} download={`seul2027-${photo.id}.jpg`} aria-label="Scarica la foto" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-text">
              <Download className="w-[24px] h-[24px]" />
            </a>
          )}
        </div>

        <div className="px-3.5 pb-28 space-y-1.5 text-[14px] leading-snug text-slate-200">
          {photo.likes.length > 0 ? (
            <button type="button" onClick={() => setLikers(true)} aria-haspopup="dialog" className="block min-h-[32px] text-left text-[13.5px] text-slate-300" data-testid="pv-likes">{likeLine}</button>
          ) : (
            <p className="text-[13.5px] text-slate-300" data-testid="pv-likes">{likeLine}</p>
          )}
          {photo.caption && (
            <p>
              <b className="text-app-text font-bold mr-1.5">{photo.uploaderName}</b>
              {caption(photo.caption)}
            </p>
          )}
          {day && p.onDay && (
            <button type="button" onClick={p.onDay} className="inline-flex items-center gap-1.5 min-h-[32px] text-[12.5px] font-semibold text-fam-itinerary" data-testid="pv-day">
              <CalendarDays className="w-3.5 h-3.5" />
              {day.id === 0 ? 'Partenza' : `Giorno ${day.id}`} · {day.title}
            </button>
          )}

          {comments.length > 3 && !expanded && (
            <button type="button" onClick={() => setExpanded(true)} className="block min-h-[32px] text-[13.5px] text-app-muted" data-testid="pv-all-comments">
              Mostra tutti i {comments.length} commenti
            </button>
          )}
          <ul className="space-y-2 pt-0.5" aria-label="Commenti">
            {visibleComments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 group">
                <Avatar name={c.authorName} url={c.authorAvatar} size="w-7 h-7" />
                <div className="min-w-0 flex-1">
                  <p><b className="text-app-text font-bold mr-1.5">{c.authorName}</b>{caption(c.text)}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-[11.5px] text-app-muted">
                    <span>{ago(c.createdAt)}</span>
                    {p.canDeleteComment(c) && (
                      <button type="button" onClick={() => p.onDeleteComment(c.id)} className="min-h-[28px] font-semibold hover:text-red-300" aria-label={`Elimina il commento di ${c.authorName}`}>
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {comments.length === 0 && <p className="text-[13px] text-app-muted">Nessun commento: scrivi il primo.</p>}
          <p className="pt-1 text-[11px] uppercase tracking-wide text-app-muted">
            {new Date(photo.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Campo commento fisso in basso */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.onSendComment();
        }}
        className="shrink-0 flex items-center gap-2.5 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-app-line bg-app-bg"
      >
        <Avatar name={p.currentUserName || '?'} url={p.currentUserAvatar} size="w-8 h-8" />
        <label className="sr-only" htmlFor="pv-comment">Aggiungi un commento</label>
        <input
          id="pv-comment"
          ref={inputRef}
          value={p.commentText}
          onChange={(e) => p.onCommentText(e.target.value)}
          maxLength={p.commentMax}
          placeholder="Aggiungi un commento…"
          enterKeyHint="send"
          className="flex-1 min-w-0 min-h-[44px] rounded-full bg-app-surface border border-app-control px-4 text-[14px] text-app-text placeholder:text-app-placeholder outline-none focus:border-app-accent"
          data-testid="pv-input"
        />
        <button type="submit" disabled={!p.commentText.trim()} className="min-h-[44px] px-1.5 text-[14px] font-bold text-app-accent disabled:text-app-accent/40" data-testid="pv-send">
          Pubblica
        </button>
      </form>

      {/* Elenco di chi ha messo mi piace */}
      {likers && (
        <div className="fixed inset-0 z-[2] flex items-end" role="dialog" aria-modal="true" aria-label="Mi piace" data-testid="pv-likers">
          <button type="button" aria-label="Chiudi" tabIndex={-1} onClick={() => setLikers(false)} className="absolute inset-0 bg-[rgba(3,6,12,0.72)]" />
          <div className="relative w-full max-h-[75dvh] flex flex-col rounded-t-3xl bg-app-raised border-t border-app-line pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] animate-sheet-up">
            <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-600" />
            <div className="flex items-center px-4 pb-2 border-b border-app-line">
              <h2 className="flex-1 text-center text-[15px] font-bold text-app-text pl-11">Mi piace</h2>
              <button type="button" onClick={() => setLikers(false)} aria-label="Chiudi" className="w-11 h-11 rounded-xl flex items-center justify-center text-app-muted"><X className="w-5 h-5" /></button>
            </div>
            <ul className="overflow-y-auto overscroll-contain px-2 pt-1">
              {photo.likes.map((uid, i) => (
                <li key={uid} className="min-h-[56px] px-2 flex items-center gap-3" data-testid="pv-liker">
                  <Avatar name={photo.likeNames[i] ?? '?'} url={photo.likeAvatars[i]} size="w-9 h-9" />
                  <span className="flex-1 min-w-0 truncate text-[14.5px] font-semibold text-app-text">{photo.likeNames[i]}</span>
                  {uid === p.currentUserId && <span className="text-[12px] font-semibold text-fam-gallery">Tu</span>}
                  <Heart className="w-4 h-4 fill-fam-gallery text-fam-gallery shrink-0" aria-hidden />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Menu "…" */}
      {menu && (
        <div className="fixed inset-0 z-[1] flex items-end" role="dialog" aria-modal="true" aria-label="Opzioni foto">
          <button type="button" aria-label="Chiudi" tabIndex={-1} onClick={() => setMenu(false)} className="absolute inset-0 bg-[rgba(3,6,12,0.72)]" />
          <div className="relative w-full rounded-t-3xl bg-app-raised border-t border-app-line pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] animate-sheet-up">
            <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-600" />
            <ul className="px-2 text-[15px]">
              {p.fullImageUrl && (
                <li><a href={p.fullImageUrl} download={`seul2027-${photo.id}.jpg`} onClick={() => setMenu(false)} className="w-full min-h-[52px] px-3 rounded-xl flex items-center gap-3 text-app-text"><Download className="w-5 h-5" /> Scarica ({photo.dimensions.width}×{photo.dimensions.height})</a></li>
              )}
              {p.onMap && (
                <li><button type="button" onClick={() => { setMenu(false); p.onMap!(); }} className="w-full min-h-[52px] px-3 rounded-xl flex items-center gap-3 text-app-text"><MapPin className="w-5 h-5 text-fam-tools" /> Vedi sulla mappa</button></li>
              )}
              {p.onDay && (
                <li><button type="button" onClick={() => { setMenu(false); p.onDay!(); }} className="w-full min-h-[52px] px-3 rounded-xl flex items-center gap-3 text-app-text"><CalendarDays className="w-5 h-5 text-fam-itinerary" /> Apri il giorno nell'itinerario</button></li>
              )}
              {p.isOwner && (
                <li><button type="button" onClick={() => { setMenu(false); p.onDelete(); }} className="w-full min-h-[52px] px-3 rounded-xl flex items-center gap-3 text-red-300 font-semibold" data-testid="pv-delete"><Trash2 className="w-5 h-5" /> Elimina la foto</button></li>
              )}
              <li className="mt-1 border-t border-app-line"><button type="button" onClick={() => setMenu(false)} className="w-full min-h-[52px] px-3 rounded-xl flex items-center gap-3 text-app-muted"><X className="w-5 h-5" /> Annulla</button></li>
            </ul>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
