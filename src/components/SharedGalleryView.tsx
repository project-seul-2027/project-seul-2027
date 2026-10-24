import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Heart,
  MessageCircle,
  MapPin,
  Calendar,
  Filter,
  Search,
  Upload,
  Plus,
  X,
  Sparkles,
  User,
  Trash2,
  Send,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Share2,
  Clock,
  Compass,
  ArrowRight,
  AlertTriangle,
  Download,
  Loader2
} from 'lucide-react';
import type { GalleryPhoto, GalleryComment, PhotoDoc, CommentDoc } from '../types/gallery';
import {
  galleryService,
  compressImage,
  describeGalleryError,
  CAPTION_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  type CompressedImage
} from '../services/galleryService';
import { MAP_LOCATIONS, ITINERARY_DAYS, type MapLocation } from '../data/tripData';
import { useAuth } from '../auth/AuthContext';
import {
  savePendingCamera,
  markPendingAccepted,
  loadPendingCamera,
  clearPendingCamera,
  hasResumeFlag,
  setResumeFlag
} from '../services/pendingCamera';
import { CameraCaptureModal } from './CameraCaptureModal';

/** Foto caricate alla volta (ogni miniatura pesa ~30 KB); "Mostra altre" ne aggiunge altrettante */
const PAGE_SIZE = 48;
/** Dopo questo tempo senza risposta del server si avvisa che la connessione è lenta */
const SLOW_NETWORK_MS = 25_000;
const SLOW = Symbol('slow');

function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | typeof SLOW> {
  return Promise.race([promise, new Promise<typeof SLOW>((resolve) => setTimeout(() => resolve(SLOW), ms))]);
}

const LOCATION_GROUPS: { label: string; categories: MapLocation['category'][] }[] = [
  { label: '🏠 Alloggi', categories: ['alloggio'] },
  { label: '🏯 Cultura & Natura', categories: ['cultura', 'natura'] },
  { label: '🔥 Cibo, Shopping & Movida', categories: ['food', 'nightlife'] },
  { label: '🚆 Gite fuori porta', categories: ['gita'] },
  { label: '✈️ Aeroporti & Scali', categories: ['logistica'] }
];

interface SharedGalleryViewProps {
  onNavigateToMap: (locationId: string, dayNumber?: number) => void;
  onNavigateToDay: (dayNumber: number) => void;
}

export const SharedGalleryView: React.FC<SharedGalleryViewProps> = ({
  onNavigateToMap,
  onNavigateToDay
}) => {
  const { user, group } = useAuth();
  const currentUserId = user?.id ?? '';
  const currentUserName = user?.displayName || user?.firstName || '';

  // Dati in tempo reale da Firestore (condivisi tra tutti i partecipanti)
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [photoDocs, setPhotoDocs] = useState<PhotoDoc[]>([]);
  const [commentDocs, setCommentDocs] = useState<CommentDoc[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // Foto appena scattata con la fotocamera: va confermata prima di compilare luogo, giorno e didascalia
  const [cameraPending, setCameraPending] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Filtri e Ricerca
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterUploader, setFilterUploader] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'chronological'>('recent');

  // Form di caricamento
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalSizeKb: number;
    compressedSizeKb: number;
    ratio: number;
    width: number;
    height: number;
  } | null>(null);

  const [selectedLocationOption, setSelectedLocationOption] = useState<string>('');
  const [customLocationName, setCustomLocationName] = useState<string>('');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | ''>('');
  const [captionText, setCaptionText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Commento inline nel modale o nella card
  const [activeCommentPhotoId, setActiveCommentPhotoId] = useState<string | null>(null);
  const [inlineCommentText, setInlineCommentText] = useState<string>('');

  // Dialog di conferma eliminazione foto e notifiche (anti-iframe alert/confirm block)
  const [photoToDelete, setPhotoToDelete] = useState<GalleryPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast notifiche
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Foto in tempo reale (le ultime `pageSize`)
  useEffect(() => {
    if (!currentUserId) return;
    return galleryService.watchPhotos(
      pageSize,
      (docs) => {
        setPhotoDocs(docs);
        setPhotosLoaded(true);
        setLoadError(null);
      },
      (err) => {
        console.warn('Impossibile leggere la galleria:', err);
        setPhotosLoaded(true);
        setLoadError(describeGalleryError(err));
      }
    );
  }, [currentUserId, pageSize]);

  // Commenti in tempo reale
  useEffect(() => {
    if (!currentUserId) return;
    return galleryService.watchComments(setCommentDocs, (err) => {
      console.warn('Impossibile leggere i commenti:', err);
    });
  }, [currentUserId]);

  // Partecipanti registrati: servono per nomi, avatar, @tag e filtri (niente nomi inventati)
  const people = useMemo(
    () =>
      group.map((m) => ({
        uid: m.id,
        slotId: m.travelerId as string,
        name: m.displayName || m.firstName,
        avatar: m.avatarUrl || undefined
      })),
    [group]
  );
  const personByUid = useMemo(() => new Map(people.map((p) => [p.uid, p])), [people]);

  // Foto pronte per la grafica: nomi risolti dall'uid, commenti raggruppati
  const photos = useMemo<GalleryPhoto[]>(() => {
    const commentsByPhoto = new Map<string, GalleryComment[]>();
    for (const c of commentDocs) {
      const author = personByUid.get(c.authorId);
      const list = commentsByPhoto.get(c.photoId) ?? [];
      list.push({
        id: c.id,
        authorId: c.authorId,
        authorName: author?.name ?? 'Ex partecipante',
        authorAvatar: author?.avatar,
        authorSlotId: author?.slotId,
        text: c.text,
        createdAt: c.createdAt
      });
      commentsByPhoto.set(c.photoId, list);
    }
    return photoDocs.map((d) => {
      const uploader = personByUid.get(d.uploaderId);
      return {
        id: d.id,
        thumbUrl: d.thumb,
        originalSizeKb: d.originalSizeKb,
        compressedSizeKb: d.compressedSizeKb,
        dimensions: { width: d.width, height: d.height },
        uploaderId: d.uploaderId,
        uploaderName: uploader?.name ?? 'Ex partecipante',
        uploaderAvatar: uploader?.avatar,
        uploaderSlotId: uploader?.slotId,
        caption: d.caption,
        taggedUsers: d.taggedSlots
          .map((slot) => people.find((p) => p.slotId === slot)?.name)
          .filter((n): n is string => !!n),
        locationName: d.locationName,
        locationId: d.locationId,
        dayNumber: d.dayNumber,
        dayLabel: d.dayLabel,
        createdAt: d.createdAt,
        likes: d.likes,
        likeNames: d.likes.map((uid) => personByUid.get(uid)?.name ?? 'Ex partecipante'),
        comments: commentsByPhoto.get(d.id) ?? []
      };
    });
  }, [photoDocs, commentDocs, personByUid, people]);

  const selectedPhoto = useMemo(
    () => photos.find((p) => p.id === selectedPhotoId) ?? null,
    [photos, selectedPhotoId]
  );
  const setSelectedPhoto = (photo: GalleryPhoto | null) => setSelectedPhotoId(photo ? photo.id : null);

  // Foto a piena qualità: si scarica solo all'apertura e si tiene in memoria per riaprirla subito
  const fullCache = useRef(new Map<string, string>());
  const [fullImage, setFullImage] = useState<{ id: string; url: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!selectedPhotoId) {
      setFullImage(null);
      return;
    }
    const cached = fullCache.current.get(selectedPhotoId);
    if (cached) {
      setFullImage({ id: selectedPhotoId, url: cached, failed: false });
      return;
    }
    let cancelled = false;
    setFullImage({ id: selectedPhotoId, url: null, failed: false });
    galleryService
      .getFullImage(selectedPhotoId)
      .then((url) => {
        fullCache.current.set(selectedPhotoId, url);
        if (fullCache.current.size > 10) {
          const oldest = fullCache.current.keys().next().value;
          if (oldest !== undefined) fullCache.current.delete(oldest);
        }
        if (!cancelled) setFullImage({ id: selectedPhotoId, url, failed: false });
      })
      .catch(() => {
        if (!cancelled) setFullImage({ id: selectedPhotoId, url: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPhotoId]);
  const fullImageUrl = fullImage && fullImage.id === selectedPhotoId ? fullImage.url : null;
  const fullImageFailed = !!fullImage && fullImage.id === selectedPhotoId && fullImage.failed;

  // Luoghi dell'elenco "dove è stata scattata": presi dai dati della mappa, così coincidono sempre
  const locationGroups = useMemo(
    () =>
      LOCATION_GROUPS.map((g) => ({
        label: g.label,
        items: MAP_LOCATIONS.filter((l) => g.categories.includes(l.category))
      })).filter((g) => g.items.length > 0),
    []
  );

  // Lista di tutti i luoghi unici presenti nelle foto
  const uniquePhotoLocations = useMemo(() => {
    const locs = new Set<string>();
    photos.forEach(p => {
      if (p.locationName) locs.add(p.locationName);
    });
    return Array.from(locs);
  }, [photos]);

  const showError = (prefix: string, err: unknown) =>
    setToastMessage({ text: `${prefix} ${describeGalleryError(err)}`, type: 'error' });

  // Handler per i Like (ognuno può toccare solo il proprio: lo garantiscono anche le regole Firestore)
  const handleToggleLike = (photoId: string) => {
    if (!currentUserId) return;
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    galleryService
      .setLike(photoId, currentUserId, !photo.likes.includes(currentUserId))
      .catch((err) => showError('Impossibile aggiornare il "mi piace".', err));
  };

  // Handler per aggiunta commento
  const handleAddComment = (photoId: string, text: string) => {
    const clean = text.trim();
    if (!clean || !currentUserId) return;
    setInlineCommentText('');
    galleryService
      .addComment(photoId, currentUserId, clean)
      .catch((err) => showError('Commento non inviato.', err));
  };

  // Chi ha scritto il commento (o l'autore della foto) può cancellarlo
  const canDeleteComment = (photo: GalleryPhoto, comment: GalleryComment): boolean =>
    !!currentUserId && (comment.authorId === currentUserId || photo.uploaderId === currentUserId);

  const handleDeleteComment = (commentId: string) => {
    galleryService
      .deleteComment(commentId)
      .catch((err) => showError('Impossibile eliminare il commento.', err));
  };

  // Solo chi ha caricato la foto può eliminarla (controllo sull'uid; le regole Firestore lo impongono lato server)
  const isPhotoPublisher = (photo: GalleryPhoto): boolean =>
    !!currentUserId && photo.uploaderId === currentUserId;

  // Apertura modale di conferma eliminazione foto
  const onRequestDeletePhoto = (photo: GalleryPhoto, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!isPhotoPublisher(photo)) {
      setToastMessage({
        text: `Non hai i permessi per eliminare questa foto. Solo l'autore (${photo.uploaderName}) può rimuoverla.`,
        type: 'error'
      });
      return;
    }

    setPhotoToDelete(photo);
  };

  // Esecuzione effettiva eliminazione foto confermata dall'utente
  const confirmDeletePhoto = async () => {
    if (!photoToDelete || isDeleting) return;
    const target = photoToDelete;
    setIsDeleting(true);
    try {
      const outcome = await settleWithin(
        galleryService.deletePhoto(target.id, target.comments.map((c) => c.id)),
        SLOW_NETWORK_MS
      );
      if (selectedPhotoId === target.id) setSelectedPhotoId(null);
      fullCache.current.delete(target.id);
      setToastMessage(
        outcome === SLOW
          ? { text: 'Connessione lenta: la foto verrà rimossa appena possibile.', type: 'success' }
          : { text: `Foto "${target.locationName || 'senza luogo'}" rimossa dalla galleria condivisa.`, type: 'success' }
      );
    } catch (err) {
      showError('Impossibile rimuovere la foto.', err);
    } finally {
      setIsDeleting(false);
      setPhotoToDelete(null);
    }
  };

  // Elaborazione e compressione file caricato
  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    setIsCompressing(true);
    setUploadError(null);
    try {
      const res = await compressImage(file);
      setCompressed(res);
      setPreviewDataUrl(res.full);
      setCompressionStats({
        originalSizeKb: res.originalSizeKb,
        compressedSizeKb: res.compressedSizeKb,
        ratio: res.compressionRatio,
        width: res.width,
        height: res.height
      });
    } catch (err) {
      setUploadError((err as Error).message || 'Errore nella compressione dell\'immagine.');
      setPreviewDataUrl(null);
      setCompressed(null);
    } finally {
      setIsCompressing(false);
    }
  };

  // Foto scattata con la fotocamera del telefono: apre il modal in attesa di conferma
  const handleCameraCapture = (file: File) => {
    resetUploadForm();
    setIsUploadOpen(true);
    setCameraPending(true);
    void savePendingCamera(file, false);
    void handleFileSelect(file);
  };

  // Fotocamera di sistema (ripiego): Android/iOS possono chiudere l'app durante lo scatto,
  // quindi si segna di riaprire la galleria al ritorno
  const openSystemCamera = () => {
    setResumeFlag();
    cameraInputRef.current?.click();
  };

  // Fotocamera dentro l'app (preferita): non si esce dalla pagina; ripiego sulla fotocamera di sistema
  const openCamera = () => {
    const hasLiveCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    if (hasLiveCamera) setIsCameraOpen(true);
    else openSystemCamera();
  };

  // Scatta di nuovo: chiude l'anteprima e riapre la fotocamera
  const retakeCameraPhoto = () => {
    resetUploadForm();
    setCameraPending(false);
    void clearPendingCamera();
    openCamera();
  };

  // Se si annulla la fotocamera di sistema non c'è nulla da ripristinare
  useEffect(() => {
    const input = cameraInputRef.current;
    if (!input) return;
    const onCancel = () => {
      void clearPendingCamera();
    };
    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, []);

  // Ritorno dalla fotocamera: il telefono può aver ricaricato l'app, quindi ripristina foto e modal
  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasResumeFlag()) return;
      const pending = await loadPendingCamera();
      if (!pending) {
        // L'app è stata chiusa durante lo scatto e la foto non è arrivata: nulla da ripristinare
        await clearPendingCamera();
        return;
      }
      if (!active) return;
      setIsUploadOpen(true);
      setCameraPending(!pending.accepted);
      await handleFileSelect(pending.file);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chiudendo il modal la foto in attesa viene scartata
  const wasUploadOpen = useRef(false);
  useEffect(() => {
    if (isUploadOpen) {
      wasUploadOpen.current = true;
      return;
    }
    if (wasUploadOpen.current) {
      wasUploadOpen.current = false;
      void clearPendingCamera();
    }
  }, [isUploadOpen]);

  // Inserimento tag @nome
  const handleInsertTag = (name: string) => {
    const tag = `@${name} `;
    if (!captionText.includes(tag)) {
      setCaptionText(prev => (prev ? `${prev.trim()} ${tag}` : tag));
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setPreviewDataUrl(null);
    setCompressed(null);
    setCompressionStats(null);
    setSelectedLocationOption('');
    setCustomLocationName('');
    setSelectedDayNumber('');
    setCaptionText('');
    setUploadError(null);
    setCameraPending(false);
  };

  // Pubblicazione nuova foto
  const handlePublishPhoto = async () => {
    if (isPublishing) return;
    if (!compressed || !previewDataUrl) {
      setUploadError('Seleziona prima una foto da caricare.');
      return;
    }
    if (!currentUserId) {
      setUploadError('Devi aver effettuato l\'accesso per pubblicare.');
      return;
    }

    // Risoluzione luogo
    let finalLocationName = '';
    let matchedLocationId: string | undefined = undefined;

    if (selectedLocationOption === '__custom__') {
      if (!customLocationName.trim()) {
        setUploadError('Inserisci il nome del luogo personalizzato dove è stata scattata la foto.');
        return;
      }
      finalLocationName = customLocationName.trim().slice(0, 120);
    } else if (selectedLocationOption) {
      const locMatch = MAP_LOCATIONS.find(l => l.id === selectedLocationOption);
      if (locMatch) {
        finalLocationName = locMatch.italianName || locMatch.name;
        matchedLocationId = locMatch.id;
      } else {
        finalLocationName = selectedLocationOption;
      }
    } else {
      setUploadError('Seleziona il luogo dello scatto oppure scegline uno personalizzato.');
      return;
    }

    // Compagni menzionati con @nome nella didascalia
    const caption = captionText.trim();
    const lowerCaption = caption.toLowerCase();
    const taggedSlots = people
      .filter((p) => p.name && lowerCaption.includes(`@${p.name.toLowerCase()}`))
      .map((p) => p.slotId);

    // Etichetta del giorno (il giorno 0 è la partenza)
    let dayNumber: number | undefined;
    let dayLabel: string | undefined;
    if (typeof selectedDayNumber === 'number') {
      dayNumber = selectedDayNumber;
      const itDay = ITINERARY_DAYS.find(d => d.id === selectedDayNumber);
      dayLabel = (itDay
        ? `Giorno ${itDay.id} · ${itDay.dateStr} (${itDay.title})`
        : `Giorno ${selectedDayNumber}`
      ).slice(0, 120);
    }

    setIsPublishing(true);
    setUploadError(null);
    try {
      const outcome = await settleWithin(
        galleryService.publish({
          uploaderId: currentUserId,
          image: compressed,
          caption,
          taggedSlots,
          locationName: finalLocationName,
          locationId: matchedLocationId,
          dayNumber,
          dayLabel
        }),
        SLOW_NETWORK_MS
      );
      setIsUploadOpen(false);
      resetUploadForm();
      setToastMessage({
        text:
          outcome === SLOW
            ? 'Connessione lenta: la foto verrà pubblicata appena possibile.'
            : 'Foto pubblicata nella galleria condivisa!',
        type: 'success'
      });
    } catch (err) {
      setUploadError(`Pubblicazione non riuscita. ${describeGalleryError(err)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Funzione per formattare la didascalia con i tag @ evidenziati
  const mentionSplit = useMemo(() => {
    const names = people
      .map((p) => p.name)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return names.length ? new RegExp(`(@(?:${names.join('|')}))`, 'i') : null;
  }, [people]);

  const renderFormattedCaption = (text: string) => {
    if (!text) return null;
    const parts = mentionSplit ? text.split(mentionSplit) : [text];
    return (
      <span className="leading-relaxed">
        {parts.map((part, index) => {
          // con un solo gruppo di cattura, gli indici dispari sono le menzioni
          if (mentionSplit && index % 2 === 1) {
            const name = part.slice(1);
            return (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold text-xs hover:bg-cyan-900/90 transition-colors"
                title={`Partecipante taggato: ${name}`}
              >
                <User className="w-2.5 h-2.5 text-cyan-400" />
                @{name}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Filtro e Ordinamento foto
  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    // Filtro Luogo
    if (filterLocation !== 'all') {
      result = result.filter(p => p.locationName === filterLocation || p.locationId === filterLocation);
    }

    // Filtro Uploader (per uid)
    if (filterUploader !== 'all') {
      result = result.filter(p => p.uploaderId === filterUploader);
    }

    // Filtro Giorno
    if (filterDay !== 'all') {
      const dayNum = parseInt(filterDay, 10);
      result = result.filter(p => p.dayNumber === dayNum);
    }

    // Ricerca testuale
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.caption.toLowerCase().includes(q) ||
        p.locationName.toLowerCase().includes(q) ||
        p.uploaderName.toLowerCase().includes(q) ||
        p.taggedUsers.some(u => u.toLowerCase().includes(q))
      );
    }

    // Ordinamento
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'popular') {
      result.sort((a, b) => b.likes.length - a.likes.length);
    } else if (sortBy === 'chronological') {
      // il giorno 0 (partenza) viene per primo; le foto senza giorno in fondo
      result.sort((a, b) => (a.dayNumber ?? 999) - (b.dayNumber ?? 999));
    }

    return result;
  }, [photos, filterLocation, filterUploader, filterDay, searchQuery, sortBy]);

  // Calcolo statistiche bacheca (sulle foto caricate in pagina)
  const hasMore = photoDocs.length >= pageSize;
  const stats = useMemo(() => {
    const totalPhotos = photos.length;
    const uniquePlaces = new Set(photos.map(p => p.locationName)).size;
    const totalLikes = photos.reduce((acc, p) => acc + p.likes.length, 0);
    const coveredDays = new Set(photos.map(p => p.dayNumber).filter((d): d is number => d !== undefined)).size;
    return { totalPhotos, uniquePlaces, totalLikes, coveredDays };
  }, [photos]);

  return (
    <div className="space-y-6">
      {/* Header Bacheca Condivisa */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1424] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow di sfondo */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span className="uppercase tracking-wider font-semibold">Bacheca Foto 4 Partecipanti</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Sincronizzata in tempo reale</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
              Galleria Condivisa del Viaggio
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tutte le foto scattate da ciascuno durante il viaggio a Seul e nello scalo a Pechino,
              collegate alla cronologia dell'itinerario (giorni 1–19) e alla mappa dei luoghi.
              Le foto sono visibili a tutto il gruppo in tempo reale e vengono ottimizzate in automatico (max 1600 px).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Carica Nuova Foto</span>
            </button>

            {/* Solo smartphone: apre direttamente la fotocamera del telefono */}
            <button
              type="button"
              onClick={openCamera}
              className="md:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-bold text-xs shadow-lg shadow-black/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scatta Foto</span>
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleCameraCapture(file);
              }}
            />

            {isCameraOpen && (
              <CameraCaptureModal
                onCapture={(file) => {
                  setIsCameraOpen(false);
                  handleCameraCapture(file);
                }}
                onClose={() => setIsCameraOpen(false)}
                onUseSystemCamera={() => {
                  setIsCameraOpen(false);
                  openSystemCamera();
                }}
              />
            )}
          </div>
        </div>

        {/* Barra Statistiche Bacheca */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Foto Pubblicate</span>
            <div className="text-lg sm:text-xl font-bold font-display text-white mt-0.5 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>{stats.totalPhotos}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Luoghi Immortalati</span>
            <div className="text-lg sm:text-xl font-bold font-display text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>{stats.uniquePlaces}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Mi Piace Totali</span>
            <div className="text-lg sm:text-xl font-bold font-display text-pink-400 mt-0.5 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
              <span>{stats.totalLikes}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Giorni Coperti</span>
            <div className="text-lg sm:text-xl font-bold font-display text-amber-400 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{stats.coveredDays} / {ITINERARY_DAYS.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Errore di lettura (es. regole Firestore non ancora pubblicate) */}
      {loadError && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-red-300">Impossibile caricare la galleria</strong>
            <span>{loadError}</span>
          </div>
        </div>
      )}

      {/* Caricamento iniziale, galleria vuota o contenuto */}
      {!photosLoaded ? (
        <div className="flex items-center justify-center gap-3 p-12 rounded-3xl bg-slate-900 border border-slate-800 text-slate-300 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Carico le foto del gruppo…</span>
        </div>
      ) : loadError && photos.length === 0 ? null : photos.length === 0 ? (
        <div className="bg-gradient-to-b from-slate-900 via-[#0a101d] to-slate-900 border border-cyan-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-6 relative overflow-hidden">
          {/* Sfondo luminoso d'atmosfera */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-xl mx-auto space-y-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-cyan-950 to-blue-900/60 border border-cyan-500/50 flex items-center justify-center mx-auto text-cyan-400 shadow-xl shadow-cyan-500/15">
              <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-xs font-semibold text-cyan-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Bacheca Ricordi di Viaggio
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold font-display text-white tracking-tight">
                La Galleria Condivisa è ancora vuota
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Nessuna foto è stata ancora pubblicata dal gruppo. Questa bacheca raccoglierà
                tutti i ricordi del viaggio a Seul e dello scalo a Pechino (2–19 marzo).
                Inizia tu caricando il primo scatto!
              </p>
            </div>

            {/* Schede informative per i 4 partecipanti */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Ottimizzazione automatica</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Carica da telefono o PC: le foto vengono ridimensionate (max 1600 px) e compresse in automatico, così il caricamento è veloce anche con la rete mobile.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Mappa & Itinerario (1–19)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Collega ogni foto a una delle 19 tappe del viaggio o ai luoghi visitati (Gyeongbokgung, Hongdae, Namsan, Pechino).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-pink-300">
                  <Heart className="w-4 h-4 text-pink-400 shrink-0" />
                  <span>Like, Commenti & @Tag</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Menziona i compagni con @nome nella didascalia, scambia commenti e lascia cuoricini ❤️.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Trash2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Eliminazione Riservata</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Solo il partecipante che ha caricato una determinata foto ha i permessi per eliminarla dalla bacheca.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Carica la Prima Foto del Viaggio</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar Filtri, Ricerca e Ordinamento (visibile quando ci sono foto nella bacheca) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Cerca */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per luogo, didascalia, @tag o autore..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Ordinamento */}
              <div className="flex items-center gap-2 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400">Ordina:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="recent">Più recenti</option>
                  <option value="popular">Più popolari (Like ❤️)</option>
                  <option value="chronological">Itinerario (per giorno)</option>
                </select>
              </div>
            </div>

            {/* Riga Filtri Specializzati: Luogo, Chi l'ha scattata, Giorno */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
              {/* Filtro Luogo */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400 shrink-0">Luogo:</span>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs w-full focus:outline-none cursor-pointer truncate"
                >
                  <option value="all" className="bg-slate-900">Tutti i luoghi ({uniquePhotoLocations.length})</option>
                  {uniquePhotoLocations.map(loc => (
                    <option key={loc} value={loc} className="bg-slate-900">
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Chi l'ha scattata */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400 shrink-0">Scattata da:</span>
                <select
                  value={filterUploader}
                  onChange={(e) => setFilterUploader(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs w-full focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Tutti i viaggiatori</option>
                  {people.map(person => (
                    <option key={person.uid} value={person.uid} className="bg-slate-900">
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Giorno Itinerario */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400 shrink-0">Giorno:</span>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs w-full focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Tutti i giorni ({ITINERARY_DAYS.length})</option>
                  {ITINERARY_DAYS.map(day => (
                    <option key={day.id} value={day.id.toString()} className="bg-slate-900">
                      Giorno {day.id} · {day.dateStr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Indicatori filtri attivi */}
            {(filterLocation !== 'all' || filterUploader !== 'all' || filterDay !== 'all' || searchQuery) && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span>
                  Mostrando <strong>{filteredPhotos.length}</strong> su {photos.length} foto con i filtri attivi
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterLocation('all');
                    setFilterUploader('all');
                    setFilterDay('all');
                    setSearchQuery('');
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline cursor-pointer"
                >
                  Azzera tutti i filtri
                </button>
              </div>
            )}
          </div>

          {/* Griglia Foto o Messaggio Filtri Vuoti */}
          {filteredPhotos.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">Nessuna foto trovata per questi filtri</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Nessuno scatto corrisponde ai filtri selezionati. Prova ad azzerare i parametri oppure pubblica una nuova foto!
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFilterLocation('all');
                    setFilterUploader('all');
                    setFilterDay('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Azzera filtri
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Carica una foto per questo filtro</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPhotos.map((photo) => {
                const isLikedByMe = photo.likes.includes(currentUserId);
                const isPublisher = isPhotoPublisher(photo);

                return (
                  <div
                    key={photo.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-3xl overflow-hidden shadow-lg flex flex-col transition-all group"
                  >
                    {/* Header Card: Autore & Data & Tasto Elimina SOLO per l'autore */}
                    <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden shadow-sm">
                          {photo.uploaderAvatar ? (
                            <img src={photo.uploaderAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            photo.uploaderName.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate">
                              {photo.uploaderName}
                            </span>
                            {photo.uploaderSlotId && (
                              <span className="text-[10px] bg-slate-800 text-cyan-300 font-mono px-1.5 py-0.2 rounded border border-slate-700">
                                {photo.uploaderSlotId.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {new Date(photo.createdAt).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Solo il pubblicatore della foto può eliminarla */}
                      {isPublisher && (
                        <button
                          type="button"
                          onClick={(e) => onRequestDeletePhoto(photo, e)}
                          title="Elimina la tua foto (visibile solo a te come autore)"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Immagine con badge sovrapposti e click per visualizzare a schermo intero */}
                    <div
                      onClick={() => setSelectedPhoto(photo)}
                      className="relative aspect-4/3 sm:aspect-16/10 bg-slate-950 overflow-hidden cursor-pointer group/img"
                    >
                      <img
                        src={photo.thumbUrl}
                        alt={photo.caption || photo.locationName}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          Ingrandisci & Dettagli
                        </span>
                      </div>

                      {/* Badge Giorno dell'Itinerario */}
                      {photo.dayNumber !== undefined && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToDay(photo.dayNumber!);
                          }}
                          className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 backdrop-blur-md text-[10px] font-bold font-mono transition-colors shadow-sm flex items-center gap-1"
                          title="Clicca per aprire l'itinerario di questo giorno"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Giorno {photo.dayNumber}</span>
                        </button>
                      )}
                    </div>

                    {/* Contenuto Card: Luogo, Didascalia, Tag */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Luogo con bottone per mappa */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (photo.locationId) {
                                onNavigateToMap(photo.locationId, photo.dayNumber);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2 py-1 transition-colors ${
                              photo.locationId
                                ? 'text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300 cursor-pointer'
                                : 'text-slate-300'
                            }`}
                            title={photo.locationId ? 'Visualizza posizione esatta sulla Mappa Interattiva' : photo.locationName}
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{photo.locationName}</span>
                            {photo.locationId && (
                              <ArrowRight className="w-3 h-3 text-emerald-400/70 shrink-0" />
                            )}
                          </button>
                        </div>

                        {/* Didascalia formattata con @tag evidenziati */}
                        <p className="text-xs text-slate-300 line-clamp-3">
                          {renderFormattedCaption(photo.caption)}
                        </p>
                      </div>

                      {/* Footer Card: Likes, Commenti e Interazioni */}
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          {/* Tasto Mi Piace */}
                          <button
                            type="button"
                            onClick={() => handleToggleLike(photo.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                              isLikedByMe
                                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <Heart
                              className={`w-4 h-4 transition-transform active:scale-125 ${
                                isLikedByMe ? 'fill-pink-400 text-pink-400' : ''
                              }`}
                            />
                            <span className="font-bold">{photo.likes.length}</span>
                          </button>

                          {/* Tasto Commenti */}
                          <button
                            type="button"
                            onClick={() => {
                              if (activeCommentPhotoId === photo.id) {
                                setActiveCommentPhotoId(null);
                              } else {
                                setActiveCommentPhotoId(photo.id);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4 text-cyan-400" />
                            <span className="font-bold">{photo.comments.length}</span>
                            <span className="text-[11px] text-slate-400">commenti</span>
                          </button>
                        </div>

                        {/* Nomi di chi ha messo like */}
                        {photo.likes.length > 0 && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            ❤️ Piace a <strong>{photo.likeNames.join(', ')}</strong>
                          </p>
                        )}

                        {/* Box Commenti Inline espandibile */}
                        {activeCommentPhotoId === photo.id && (
                          <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in duration-150">
                            {photo.comments.length > 0 ? (
                              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                                {photo.comments.map((comm) => (
                                  <div
                                    key={comm.id}
                                    className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-0.5"
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-bold text-cyan-300 inline-flex items-center gap-1.5">
                                        {comm.authorName}
                                        {canDeleteComment(photo, comm) && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteComment(comm.id)}
                                            title="Elimina commento"
                                            className="text-slate-500 hover:text-red-400 cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </span>
                                      <span className="text-slate-400 font-mono">
                                        {new Date(comm.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-slate-200 text-xs">{comm.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">
                                Nessun commento ancora. Lasciane uno per primo!
                              </p>
                            )}

                            {/* Input commento rapido */}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleAddComment(photo.id, inlineCommentText);
                              }}
                              className="flex items-center gap-1.5 pt-1"
                            >
                              <input
                                type="text"
                                value={inlineCommentText}
                                onChange={(e) => setInlineCommentText(e.target.value)}
                                placeholder={`Commenta come ${currentUserName}...`}
                                maxLength={COMMENT_MAX_LENGTH}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                              <button
                                type="submit"
                                disabled={!inlineCommentText.trim()}
                                className="p-1.5 rounded-xl bg-cyan-500 text-slate-950 disabled:opacity-40 hover:bg-cyan-400 font-bold transition-colors cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setPageSize((n) => n + PAGE_SIZE)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Mostra altre foto
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Ingrandimento Foto & Discussione Completa (Portaled to document.body) */}
      {selectedPhoto && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row my-auto max-h-[92vh]"
          >
            {/* Sinistra: Immagine ad alta risoluzione */}
            <div className="md:w-3/5 bg-black flex items-center justify-center relative p-2 min-h-[300px]">
              <img
                src={fullImageUrl ?? selectedPhoto.thumbUrl}
                alt={selectedPhoto.caption || selectedPhoto.locationName}
                className={`max-h-[80vh] w-auto max-w-full object-contain rounded-xl transition-[filter] duration-300 ${
                  fullImageUrl ? '' : 'blur-[2px]'
                }`}
              />

              {!fullImageUrl && !fullImageFailed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Loader2 className="w-8 h-8 animate-spin text-white/80" />
                </div>
              )}
              {fullImageFailed && (
                <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-black/70 text-amber-300 text-[11px] text-center">
                  Impossibile caricare la foto a piena qualità: ti mostro l'anteprima.
                </div>
              )}
              {fullImageUrl && (
                <a
                  href={fullImageUrl}
                  download={`seul2027-${selectedPhoto.id}.jpg`}
                  title={`Scarica (${selectedPhoto.dimensions.width}×${selectedPhoto.dimensions.height}, ${selectedPhoto.compressedSizeKb} KB)`}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium backdrop-blur-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="md:hidden absolute top-4 right-4 p-2 rounded-xl bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Destra: Dettagli, Luogo, Itinerario, Like & Commenti */}
            <div className="md:w-2/5 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto space-y-4 border-t md:border-t-0 md:border-l border-slate-800">
              {/* Header con Autore e tasto chiudi */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-xs">
                    {selectedPhoto.uploaderAvatar ? (
                      <img src={selectedPhoto.uploaderAvatar} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      selectedPhoto.uploaderName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {selectedPhoto.uploaderName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(selectedPhoto.createdAt).toLocaleString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPhotoPublisher(selectedPhoto) && (
                    <button
                      type="button"
                      onClick={(e) => onRequestDeletePhoto(selectedPhoto, e)}
                      title="Elimina definitivamente la tua foto dalla bacheca"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Elimina foto</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Chiudi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Informazioni Luogo e Itinerario con link interattivi */}
              <div className="space-y-2">
                {/* Luogo */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Luogo Scatto</span>
                      <strong className="text-xs text-white truncate block">
                        {selectedPhoto.locationName}
                      </strong>
                    </div>
                  </div>

                  {selectedPhoto.locationId && (
                    <button
                      type="button"
                      onClick={() => {
                        const locId = selectedPhoto.locationId!;
                        const dayNum = selectedPhoto.dayNumber;
                        setSelectedPhoto(null);
                        onNavigateToMap(locId, dayNum);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold font-mono transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Vedi Mappa</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Giorno dell'itinerario */}
                {selectedPhoto.dayNumber !== undefined && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Cronologia Itinerario</span>
                        <strong className="text-xs text-amber-300 truncate block">
                          {selectedPhoto.dayLabel || `Giorno ${selectedPhoto.dayNumber}`}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const dayNum = selectedPhoto.dayNumber!;
                        setSelectedPhoto(null);
                        onNavigateToDay(dayNum);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold font-mono transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Itinerario</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Didascalia */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-200">
                {renderFormattedCaption(selectedPhoto.caption)}
              </div>

              {/* Sezione Like */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleToggleLike(selectedPhoto.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                    selectedPhoto.likes.includes(currentUserId)
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      selectedPhoto.likes.includes(currentUserId) ? 'fill-pink-400 text-pink-400' : ''
                    }`}
                  />
                  <span>
                    {selectedPhoto.likes.includes(currentUserId) ? 'Ti piace' : 'Metti Mi Piace'}
                  </span>
                </button>

                <div className="text-right text-[11px] text-slate-400 font-mono">
                  {selectedPhoto.likes.length === 0 ? (
                    'Nessun like'
                  ) : (
                    <span>
                      ❤️ {selectedPhoto.likeNames.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Discussione Commenti */}
              <div className="space-y-2 flex-1 flex flex-col min-h-[140px]">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                  Commenti del gruppo ({selectedPhoto.comments.length})
                </span>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-44 pr-1 text-xs">
                  {selectedPhoto.comments.length === 0 ? (
                    <p className="text-slate-400 italic text-xs py-4 text-center">
                      Nessun commento per questa foto. Sii il primo a scriverne uno!
                    </p>
                  ) : (
                    selectedPhoto.comments.map((comm) => (
                      <div
                        key={comm.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <strong className="text-cyan-400 inline-flex items-center gap-1.5">
                            {comm.authorName}
                            {canDeleteComment(selectedPhoto, comm) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comm.id)}
                                title="Elimina commento"
                                className="text-slate-500 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(comm.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-200 text-xs">{comm.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Modulo invio commento */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddComment(selectedPhoto.id, inlineCommentText);
                  }}
                  className="flex items-center gap-2 pt-2 border-t border-slate-800"
                >
                  <input
                    type="text"
                    value={inlineCommentText}
                    onChange={(e) => setInlineCommentText(e.target.value)}
                    placeholder={`Scrivi un commento come ${currentUserName}...`}
                    maxLength={COMMENT_MAX_LENGTH}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={!inlineCommentText.trim()}
                    className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span>Invia</span>
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Caricamento Nuova Foto con Compressione Smart & Tagging (Portaled to document.body) */}
      {isUploadOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsUploadOpen(false)}
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 text-slate-200 my-auto max-h-[92vh] overflow-y-auto"
          >
            {/* Header Modal Caricamento */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Carica Foto nella Bacheca Condivisa
                  </h3>
                  <p className="text-xs text-slate-400">
                    Le foto vengono ridimensionate (max 1600 px) e compresse automaticamente
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
                ⚠️ {uploadError}
              </div>
            )}

            {/* Zona Drop / Selezione File */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                1. Seleziona l'immagine da caricare
              </label>

              {!previewDataUrl ? (
                <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-white text-center">
                    Clicca qui per selezionare una foto o scattala con lo smartphone
                  </span>
                  <span className="text-[11px] text-slate-400 text-center">
                    PNG, JPEG o WebP · ridimensionata a max 1600 px
                  </span>
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-black border border-slate-800">
                    <img
                      src={previewDataUrl}
                      alt="Anteprima"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        setPreviewDataUrl(null);
                        setCompressed(null);
                        setCompressionStats(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs"
                      title="Cambia immagine"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Feedback Compressione Smart */}
                  {compressionStats && (
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-xs flex items-center justify-between gap-3 text-cyan-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          <strong>Foto ottimizzata:</strong> {compressionStats.width}×{compressionStats.height}px
                        </span>
                      </div>
                      <span className="font-mono text-[11px] bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-700/50">
                        {compressionStats.originalSizeKb} KB ➔ <strong>{compressionStats.compressedSizeKb} KB</strong> (-{compressionStats.ratio}%)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Conferma della foto scattata con la fotocamera */}
            {cameraPending && previewDataUrl && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3">
                <div>
                  <p className="text-sm font-bold text-white">La foto ti convince?</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Se la accetti passiamo a luogo, giorno e didascalia, come per le foto della galleria. Altrimenti la riscatti.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraPending(false);
                      void markPendingAccepted();
                    }}
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accetta</span>
                  </button>
                  <button
                    type="button"
                    onClick={retakeCameraPhoto}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Riscatta</span>
                  </button>
                </div>
              </div>
            )}

            {!(cameraPending && previewDataUrl) && (<>
            {/* Selezione Luogo (con opzione Scrittura Personalizzata) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                2. Dove è stata scattata la foto? (Seleziona o scrivi)
              </label>

              <select
                value={selectedLocationOption}
                onChange={(e) => setSelectedLocationOption(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">-- Seleziona un luogo dall'itinerario --</option>
                {locationGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.italianName || loc.name}
                      </option>
                    ))}
                  </optgroup>
                ))}

                <optgroup label="✍️ Altro Luogo non in elenco">
                  <option value="__custom__">✍️ Scrivi un luogo personalizzato...</option>
                </optgroup>
              </select>

              {/* Input personalizzato se selezionato __custom__ */}
              {selectedLocationOption === '__custom__' && (
                <div className="pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={customLocationName}
                    onChange={(e) => setCustomLocationName(e.target.value)}
                    placeholder="Digita il nome del posto (es. Cafe Onion Anguk, Pojangmacha a Mapo, DDP Dongdaemun...)"
                    className="w-full bg-slate-950 border border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[10px] text-cyan-400 mt-1">
                    Questo luogo verrà aggiunto alla lista e sarà filtrabile da tutti i partecipanti.
                  </p>
                </div>
              )}
            </div>

            {/* Collegamento al Giorno dell'Itinerario */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                3. A quale giorno dell'itinerario corrisponde?
              </label>

              <select
                value={selectedDayNumber}
                onChange={(e) => setSelectedDayNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">-- Nessun giorno specifico (Pre-viaggio o Generico) --</option>
                {ITINERARY_DAYS.map(day => (
                  <option key={day.id} value={day.id}>
                    Giorno {day.id} · {day.dateStr} · {day.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Didascalia con Tag @nickname */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  4. Didascalia e menzioni compagni (@nome)
                </label>
                <span className="text-[11px] text-slate-400">
                  Clicca un nome sotto per taggarlo rapidamente:
                </span>
              </div>

              {/* Chip per taggare rapidamente i compagni */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {people.map(({ name }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleInsertTag(name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-[11px] text-cyan-300 font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3 text-cyan-400" />
                    <span>@{name}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="Scrivi un ricordo di questo momento... (usa @nome per menzionare un compagno)"
                rows={3}
                maxLength={CAPTION_MAX_LENGTH}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>

            {/* Bottoni Azione */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handlePublishPhoto}
                disabled={!previewDataUrl || isCompressing || isPublishing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{isPublishing ? 'Pubblico…' : isCompressing ? 'Ottimizzo la foto…' : 'Pubblica nella Bacheca Condivisa'}</span>
              </button>
            </div>
            </>)}
          </div>
        </div>,
        document.body
      )}

      {/* Modal Conferma Eliminazione Foto (In-App, non usa window.confirm) */}
      {photoToDelete && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPhotoToDelete(null)}
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  Eliminare questa foto?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Stai per rimuovere definitivamente questa foto pubblicata da <strong className="text-cyan-300">{photoToDelete.uploaderName}</strong>
                  {photoToDelete.locationName ? ` a "${photoToDelete.locationName}"` : ''}.
                  L'operazione è irreversibile e la foto non sarà più visibile agli altri membri del gruppo.
                </p>
              </div>
            </div>

            {/* Mini anteprima scatto da eliminare */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <img
                src={photoToDelete.thumbUrl}
                alt=""
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700"
              />
              <div className="min-w-0 text-xs space-y-0.5">
                <span className="font-semibold text-white truncate block">
                  {photoToDelete.locationName || 'Foto del viaggio'}
                </span>
                {photoToDelete.dayNumber !== undefined && (
                  <span className="text-[11px] text-amber-400 font-mono block">
                    Giorno {photoToDelete.dayNumber} dell'itinerario
                  </span>
                )}
                {photoToDelete.caption && (
                  <p className="text-[11px] text-slate-400 truncate">
                    "{photoToDelete.caption}"
                  </p>
                )}
              </div>
            </div>

            {/* Pulsanti Azione */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDeletePhoto}
                disabled={isDeleting}
                className="disabled:opacity-50 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Elimino…' : 'Sì, elimina definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notifiche In-App (Successo / Errore) */}
      {toastMessage && createPortal(
        <div className="fixed bottom-6 right-6 z-[10001] max-w-sm animate-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-medium ${
              toastMessage.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900/95 border-red-500/50 text-red-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="flex-1">{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
