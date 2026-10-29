import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { packingService, describePackingError, PACKING_LIMITS, type PackingSyncStatus } from '../services/packingService';
import type { PackingCategory, PackingItem, PackingListDoc, PackingLocation } from '../types/packing';
import { PACKING_CATEGORIES, PACKING_LOCATIONS } from '../types/packing';
import {
  Luggage,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  ExternalLink,
  Users,
  Search,
  Filter,
  Star,
  Lock,
  Unlock,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  FileCheck,
  Shirt,
  Cpu,
  HeartPulse,
  Package,
  PlaneTakeoff,
  Backpack,
  Briefcase,
  X
} from 'lucide-react';

const CATEGORY_ICONS: Record<PackingCategory, React.ElementType> = {
  documents: FileCheck,
  clothing: Shirt,
  electronics: Cpu,
  health: HeartPulse,
  hygiene: Sparkles,
  flight: PlaneTakeoff,
  misc: Package
};

export const PackingListView: React.FC = () => {
  const { user, group } = useAuth();
  const currentUser = user!;

  // Tab principale: "my_list" vs "shared_lists"
  const [activeSubTab, setActiveSubTab] = useState<'my_list' | 'shared_lists'>('my_list');

  // Stato lista personale
  const [myList, setMyList] = useState<PackingListDoc>({
    ownerId: currentUser.id,
    ownerName: currentUser.displayName,
    ownerSlot: currentUser.travelerId,
    updatedAt: Date.now(),
    sharedWith: [],
    items: []
  });

  // Stato della sincronizzazione con il cloud e liste condivise con l'utente da altri partecipanti
  const [syncStatus, setSyncStatus] = useState<PackingSyncStatus | 'connecting'>('connecting');
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedLists, setSharedLists] = useState<PackingListDoc[]>([]);
  const [selectedSharedOwnerId, setSelectedSharedOwnerId] = useState<string | null>(null);

  // Filtri e ricerca
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpacked' | 'packed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Telefono: i filtri restano chiusi finché servono
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  // Modali e toast
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Campi form nuovo oggetto
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PackingCategory>('clothing');
  const [newLocation, setNewLocation] = useState<PackingLocation>('backpack');
  const [newNotes, setNewNotes] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newIsEssential, setNewIsEssential] = useState(false);

  // Mostra toast temporaneo
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Nome e posto di chi ha condiviso la lista: si ricavano dal profilo (non da quanto scritto nel documento)
  const ownerDisplayName = (list: PackingListDoc) =>
    group.find((m) => m.id === list.ownerId)?.displayName || list.ownerName;
  const ownerSlotOf = (list: PackingListDoc) =>
    group.find((m) => m.id === list.ownerId)?.travelerId ?? list.ownerSlot;

  // Salvataggio fallito sul cloud: la lista resta comunque salvata su questo dispositivo
  const reportSaveError = (err: unknown) => {
    setSyncStatus('local');
    showToast(`Salvata solo su questo dispositivo. ${describePackingError(err)}`);
  };

  // Errori di salvataggio che arrivano dal server dopo un periodo senza rete
  useEffect(() => packingService.onSaveError(reportSaveError), []);

  // 1. Sottoscrizione in tempo reale alla lista dell'utente corrente
  useEffect(() => {
    const unsub = packingService.subscribeToMyList(
      currentUser.id,
      currentUser.displayName,
      currentUser.travelerId,
      (doc) => {
        setMyList(doc);
      },
      (err) => console.warn('Lista valigia non sincronizzata:', describePackingError(err)),
      setSyncStatus
    );
    return () => unsub();
  }, [currentUser.id, currentUser.displayName, currentUser.travelerId]);

  // 2. Sottoscrizione alle liste condivise con me
  useEffect(() => {
    const unsub = packingService.subscribeToSharedLists(
      currentUser.id,
      (lists) => {
        setSharedError(null);
        setSharedLists(lists);
      },
      (err) => setSharedError(describePackingError(err))
    );
    return () => unsub();
  }, [currentUser.id]);

  // Seleziona la prima lista condivisa se non ne è selezionata nessuna
  useEffect(() => {
    if (sharedLists.length > 0 && (!selectedSharedOwnerId || !sharedLists.find(l => l.ownerId === selectedSharedOwnerId))) {
      setSelectedSharedOwnerId(sharedLists[0].ownerId);
    }
  }, [sharedLists, selectedSharedOwnerId]);

  // Calcolo statistiche completamento
  const totalItems = myList.items.length;
  const packedCount = myList.items.filter((i) => i.packed).length;
  const percentPacked = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;
  const essentialCount = myList.items.filter((i) => i.isEssential).length;
  const essentialPacked = myList.items.filter((i) => i.isEssential && i.packed).length;

  // Toggle spunta oggetto
  const handleTogglePacked = async (itemId: string) => {
    const updatedItems = myList.items.map((i) =>
      i.id === itemId ? { ...i, packed: !i.packed } : i
    );
    const updatedList = { ...myList, items: updatedItems };
    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Eliminazione oggetto
  const handleDeleteItem = async (itemId: string) => {
    const updatedItems = myList.items.filter((i) => i.id !== itemId);
    const updatedList = { ...myList, items: updatedItems };
    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      showToast('Oggetto rimosso dalla valigia');
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Modifica rapida locazione oggetto (zaino, a mano, stiva)
  const handleUpdateItemLocation = async (itemId: string, location: PackingLocation) => {
    const updatedItems = myList.items.map((i) =>
      i.id === itemId ? { ...i, location } : i
    );
    const updatedList = { ...myList, items: updatedItems };
    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      const locMeta = PACKING_LOCATIONS.find((l) => l.id === location);
      showToast(`Spostato in: ${locMeta?.iconEmoji} ${locMeta?.label}`);
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Aggiunta oggetto custom
  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: PackingItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: newTitle.trim(),
      category: newCategory,
      location: newLocation,
      packed: false,
      notes: newNotes.trim() || undefined,
      quantity: Math.min(PACKING_LIMITS.maxQuantity, Math.max(1, Number.isFinite(newQuantity) ? newQuantity : 1)),
      isEssential: newIsEssential,
      createdAt: Date.now()
    };

    const updatedList = {
      ...myList,
      items: [newItem, ...myList.items]
    };

    setMyList(updatedList);
    setNewTitle('');
    setNewNotes('');
    setNewQuantity(1);
    setNewIsEssential(false);
    setNewLocation('backpack');
    setIsAddCustomOpen(false);

    try {
      await packingService.saveList(updatedList);
      showToast(`"${newItem.title}" aggiunto alla valigia!`);
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Aggiungi essenziali Seul con 1 click
  const handleAddEssentials = async () => {
    try {
      const updated = await packingService.addSeoulEssentials(myList);
      const added = updated.items.length - myList.items.length;
      setMyList(updated);
      showToast(
        added > 0
          ? `${added} oggetti essenziali per la Corea aggiunti alla tua lista!`
          : 'Hai già tutti gli oggetti essenziali nella tua lista.'
      );
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Gestione condivisione con un membro
  const handleToggleShareWith = async (targetUid: string) => {
    const isCurrentlyShared = myList.sharedWith.includes(targetUid);
    const updatedSharedWith = isCurrentlyShared
      ? myList.sharedWith.filter((id) => id !== targetUid)
      : [...myList.sharedWith, targetUid];

    const updatedList = {
      ...myList,
      sharedWith: updatedSharedWith
    };

    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      const targetMember = group.find((m) => m.id === targetUid);
      const name = targetMember ? targetMember.firstName : 'il compagno';
      showToast(
        isCurrentlyShared
          ? `Accesso revocato a ${name}`
          : `Lista valigia condivisa con ${name}!`
      );
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Condividi con tutti i partecipanti registrati
  const handleShareWithAll = async () => {
    const otherMemberUids = group.map((m) => m.id).filter((id) => id !== currentUser.id);
    const updatedList = {
      ...myList,
      sharedWith: otherMemberUids
    };
    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      showToast('Lista condivisa con tutti i partecipanti del viaggio!');
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Rendi la lista completamente privata
  const handleMakePrivate = async () => {
    const updatedList = {
      ...myList,
      sharedWith: []
    };
    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      showToast('La tua lista è ora privata (visibile solo a te)');
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Copia un oggetto da una lista condivisa nella mia lista personale
  const handleCopyFromShared = async (item: PackingItem, authorName: string) => {
    const alreadyExists = myList.items.some(
      (i) => i.title.toLowerCase().trim() === item.title.toLowerCase().trim()
    );
    if (alreadyExists) {
      showToast(`Hai già "${item.title}" nella tua valigia!`);
      return;
    }

    const copiedItem: PackingItem = {
      ...item,
      id: `copied_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      packed: false,
      notes: item.notes ? `${item.notes} (suggerito da ${authorName})` : `(suggerito da ${authorName})`,
      createdAt: Date.now()
    };

    const updatedList = {
      ...myList,
      items: [copiedItem, ...myList.items]
    };

    setMyList(updatedList);
    try {
      await packingService.saveList(updatedList);
      showToast(`"${item.title}" copiato nella tua valigia!`);
    } catch (err) {
      reportSaveError(err);
    }
  };

  // Integrazioni e condivisioni esterne
  const handleNativeShare = async () => {
    const sharedViaApi = await packingService.shareNative(myList);
    if (!sharedViaApi) {
      showToast('Lista valigia copiata negli appunti! Pronta da incollare.');
    }
  };

  const handleCopyText = async () => {
    const text = packingService.formatListForSharing(myList);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Lista copiata negli appunti in formato testo!');
    } catch {
      showToast('Impossibile copiare negli appunti: il browser non lo permette.');
    }
  };

  const handleOpenKeep = () => {
    packingService.openGoogleKeep(myList);
    showToast('Testo copiato negli appunti: incollalo nella nota di Google Keep.');
  };

  const handleDownloadIcs = () => {
    packingService.downloadIcsReminder(myList);
    showToast('Promemoria (.ics) scaricato! Aprilo per aggiungerlo a Calendario o Promemoria.');
  };

  // Filtraggio oggetti personali
  const filteredMyItems = useMemo(() => {
    return myList.items.filter((item) => {
      // Categoria
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      // Locazione bagaglio (Zaino, Valigia a mano, Valigia a stiva)
      if (selectedLocation !== 'all' && (item.location || 'checked') !== selectedLocation) return false;
      // Stato
      if (statusFilter === 'unpacked' && item.packed) return false;
      if (statusFilter === 'packed' && !item.packed) return false;
      // Ricerca testo
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inNotes = item.notes?.toLowerCase().includes(q) ?? false;
        if (!inTitle && !inNotes) return false;
      }
      return true;
    });
  }, [myList.items, selectedCategory, selectedLocation, statusFilter, searchQuery]);

  // Lista condivisa attualmente selezionata
  const currentSharedList = useMemo(() => {
    return sharedLists.find((l) => l.ownerId === selectedSharedOwnerId) || null;
  }, [sharedLists, selectedSharedOwnerId]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-teal-500/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Panoramica Valigia */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-3 md:space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  syncStatus === 'local'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                }`}
                title={
                  syncStatus === 'local'
                    ? 'Il cloud non è raggiungibile (rete assente o regole Firestore non pubblicate): le modifiche restano su questo dispositivo e verranno caricate appena possibile.'
                    : undefined
                }
              >
                {syncStatus === 'cloud'
                  ? 'Personale · salvata nel cloud'
                  : syncStatus === 'local'
                  ? 'Solo su questo dispositivo'
                  : 'Sincronizzazione…'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {myList.sharedWith.length === 0 ? (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Lock className="w-3 h-3 text-slate-500" /> Privata (solo tu)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-teal-300">
                    <Unlock className="w-3 h-3 text-teal-400" /> Condivisa con {myList.sharedWith.length} partecipanti
                  </span>
                )}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <Luggage className="w-6 h-6 text-teal-400" />
              <span>Valigia & Checklist Personale Seul 2027</span>
            </h2>
            <p className="hidden md:block text-xs text-slate-300 max-w-2xl">
              Crea e spunta gli oggetti per il tuo viaggio in Corea. I dati sono legati al tuo account{' '}
              <strong className="text-white">{currentUser.displayName}</strong>, salvati in cloud e puoi decidere se
              condividere la tua lista con i tuoi compagni di viaggio per coordinarvi.
            </p>
          </div>

          {/* Quick Actions & Export Buttons */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 shrink-0">
            {/* Pulsante Condivisione */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span>Condividi lista</span>
              {myList.sharedWith.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-purple-500/30 text-purple-300 text-[10px] flex items-center justify-center font-bold">
                  {myList.sharedWith.length}
                </span>
              )}
            </button>

            {/* Pulsante Integrazioni App (iOS, Android, Keep, Reminders) */}
            <button
              onClick={() => setIsIntegrationsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20"
            >
              <Smartphone className="w-4 h-4 text-slate-950" />
              <span className="md:hidden">App & calendario</span>
              <span className="hidden md:inline">Integrazioni App (iOS / Android)</span>
            </button>
          </div>
        </div>

        {/* Telefono: riepilogo in due numeri, barra e data del volo in una riga */}
        <div className="md:hidden pt-2 border-t border-slate-800/80 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="text-[9px] uppercase font-mono text-slate-400">Oggetti in valigia</div>
              <div className="text-base font-bold text-teal-400 font-mono">
                {packedCount}/{totalItems}{' '}
                <span className="text-[10px] font-normal text-slate-400">{percentPacked}%</span>
              </div>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="text-[9px] uppercase font-mono text-slate-400">Essenziali</div>
              <div className="text-base font-bold text-amber-400 font-mono">
                {essentialPacked}/{essentialCount}{' '}
                <span className="text-[10px] font-normal text-slate-400">pronti</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-800/70 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-300" style={{ width: `${percentPacked}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
            <span className="min-w-0 truncate">
              Malpensa 1 mar · 12:30 <span className="text-cyan-400">· check bagaglio 28 feb</span>
            </span>
            <button
              onClick={handleDownloadIcs}
              aria-label="Aggiungi sveglia al calendario"
              className="p-1.5 rounded-lg bg-slate-800 text-teal-300 shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra di Avanzamento e Indicatori */}
        <div className="hidden md:grid md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Oggetti in Valigia</div>
              <div className="text-lg font-bold text-teal-400 font-mono mt-0.5">
                {packedCount} / {totalItems}{' '}
                <span className="text-xs font-normal text-slate-400">({percentPacked}%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-teal-500/40 flex items-center justify-center font-bold text-xs font-mono text-teal-300">
              {percentPacked}%
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Essenziali da non dimenticare</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                {essentialPacked} / {essentialCount}{' '}
                <span className="text-xs font-normal text-slate-400">pronti</span>
              </div>
            </div>
            <Star className={`w-6 h-6 ${essentialPacked === essentialCount && essentialCount > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400">Partenza Volo Malpensa</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">1 Marzo 2027 · Ore 12:30</div>
              <div className="text-[10px] text-cyan-400 font-mono">Controllo bagaglio consigliato: 28 Feb</div>
            </div>
            <button
              onClick={handleDownloadIcs}
              title="Aggiungi sveglia al calendario del telefono"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 transition-colors"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra di caricamento grafica */}
        <div className="hidden md:block w-full bg-slate-800/70 rounded-full h-2 overflow-hidden border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-300"
            style={{ width: `${percentPacked}%` }}
          />
        </div>

        {/* Telefono: i tre bagagli in chip affiancati (toccando si filtra) */}
        <div className="md:hidden grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80">
          {PACKING_LOCATIONS.map((loc) => {
            const isSelected = selectedLocation === loc.id;
            const totalInLoc = myList.items.filter((i) => (i.location || 'checked') === loc.id).length;
            const packedInLoc = myList.items.filter((i) => (i.location || 'checked') === loc.id && i.packed).length;
            return (
              <button
                key={loc.id}
                onClick={() => setSelectedLocation(isSelected ? 'all' : loc.id)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? `${loc.bgColor} ${loc.borderColor} ring-1 ring-teal-500`
                    : 'bg-slate-950/70 border-slate-800/80'
                }`}
              >
                <div className="text-lg leading-none">{loc.iconEmoji}</div>
                <div className={`text-[10px] font-bold truncate mt-1 ${loc.badgeColor}`}>{loc.shortLabel}</div>
                <div className="text-[11px] font-mono font-bold text-white">
                  {packedInLoc}/{totalInLoc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Suddivisione Oggetti nei 3 Bagagli (Zaino, A mano, Stiva) con Filtro Rapido */}
        <div className="hidden md:block pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Luggage className="w-3.5 h-3.5 text-teal-400" />
              <span>Locazione Bagaglio (clicca per filtrare la valigia specifica):</span>
            </span>
            {selectedLocation !== 'all' && (
              <button
                onClick={() => setSelectedLocation('all')}
                className="text-[10px] text-teal-400 hover:text-teal-300 font-mono underline"
              >
                Mostra tutti i bagagli
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PACKING_LOCATIONS.map((loc) => {
              const isSelected = selectedLocation === loc.id;
              const totalInLoc = myList.items.filter((i) => (i.location || 'checked') === loc.id).length;
              const packedInLoc = myList.items.filter(
                (i) => (i.location || 'checked') === loc.id && i.packed
              ).length;
              const pct = totalInLoc > 0 ? Math.round((packedInLoc / totalInLoc) * 100) : 0;

              return (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(isSelected ? 'all' : loc.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? `${loc.bgColor} ${loc.borderColor} ring-1 ring-teal-500 shadow-md`
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl shrink-0">{loc.iconEmoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${loc.badgeColor}`}>{loc.label}</span>
                        {isSelected && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono font-bold">
                            ATTIVO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans line-clamp-1">
                        {loc.description.split('(')[0].trim()}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold font-mono text-white">
                      {packedInLoc}/{totalInLoc}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{pct}%</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selezione Scheda: "La mia Valigia" vs "Valigie Condivise con Me" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <button
            onClick={() => setActiveSubTab('my_list')}
            className={`w-full sm:w-auto min-w-0 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === 'my_list'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Luggage className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">La mia Valigia</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeSubTab === 'my_list' ? 'bg-slate-950/30 text-slate-900' : 'bg-slate-800 text-slate-400'
            }`}>
              {totalItems}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('shared_lists')}
            className={`w-full sm:w-auto min-w-0 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === 'shared_lists'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">Valigie Condivise con Me</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeSubTab === 'shared_lists' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {sharedLists.length}
            </span>
          </button>
        </div>

        {activeSubTab === 'my_list' && (
          <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsAddCustomOpen(true)}
              className="w-full sm:w-auto justify-center px-3 py-2.5 sm:py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aggiungi Oggetto</span>
            </button>

            {myList.items.length === 0 && (
              <button
                onClick={handleAddEssentials}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Carica Essenziali Seul (20 oggetti)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: LA MIA VALIGIA PERSONALE                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'my_list' && (
        <div className="space-y-4">
          {/* Banner di suggerimento se la lista ha pochi oggetti */}
          {myList.items.length < 5 && (
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-200">
                    Non sai cosa portare per Seul a inizio marzo?
                  </h4>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Abbiamo preparato 20 oggetti essenziali calibrati su clima (0°-12°C), requisiti aerei (Powerbank in cabina)
                    e adattatori per le prese coreane tipo C/F.
                  </p>
                </div>
              </div>
              <button
                onClick={handleAddEssentials}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 transition-colors"
              >
                Aggiungi Essenziali Seul
              </button>
            </div>
          )}

          {/* Telefono: ricerca sempre visibile, il resto dei filtri si apre con un pulsante */}
          <div className="md:hidden flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cerca oggetto…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border ${
                mobileFiltersOpen || selectedCategory !== 'all' || selectedLocation !== 'all' || statusFilter !== 'all'
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              Filtri{selectedCategory !== 'all' || selectedLocation !== 'all' || statusFilter !== 'all' ? ' •' : ''}
            </button>
          </div>

          {/* Barra di Filtri Categoria & Ricerca */}
          <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} md:flex bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex-col md:flex-row gap-3 items-stretch md:items-center justify-between min-w-0`}>
            {/* Pillole Categoria */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
                }`}
              >
                Tutti ({myList.items.length})
              </button>
              {PACKING_CATEGORIES.map((cat) => {
                const count = myList.items.filter((i) => i.category === cat.id).length;
                if (count === 0 && myList.items.length > 0) return null;
                const IconComponent = CATEGORY_ICONS[cat.id];
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1 ${
                      selectedCategory === cat.id
                        ? 'bg-teal-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
                    }`}
                  >
                    <IconComponent className="w-3 h-3" />
                    <span>{cat.label.split(' ')[0]}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Ricerca e Filtro Stato */}
            <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto md:justify-end min-w-0">
              <div className="hidden md:block relative col-span-2 md:col-span-1 md:w-48 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cerca oggetto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 sm:px-2.5 py-2 sm:py-1.5 text-[11px] sm:text-xs text-slate-300 focus:outline-none focus:border-teal-500 font-mono min-w-0 w-full"
              >
                <option value="all">🎒🧳✈️ Tutti</option>
                <option value="backpack">🎒 Solo Zaino</option>
                <option value="cabin">🧳 Solo Valigia a mano</option>
                <option value="checked">✈️ Solo Valigia da stiva</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 sm:px-2.5 py-2 sm:py-1.5 text-[11px] sm:text-xs text-slate-300 focus:outline-none focus:border-teal-500 min-w-0 w-full"
              >
                <option value="all">Tutti gli stati</option>
                <option value="unpacked">Da mettere in valigia</option>
                <option value="packed">Già messi in valigia</option>
              </select>
            </div>
          </div>

          {/* Griglia / Elenco Oggetti */}
          {filteredMyItems.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 space-y-3">
              <Luggage className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">Nessun oggetto trovato</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
                  ? 'Prova a modificare i filtri o la ricerca per visualizzare altri oggetti.'
                  : 'La tua valigia è ancora vuota. Aggiungi il tuo primo oggetto o carica gli essenziali per Seul!'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsAddCustomOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs"
                >
                  Aggiungi Oggetto Personalizzato
                </button>
                {myList.items.length === 0 && (
                  <button
                    onClick={handleAddEssentials}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
                  >
                    Carica Essenziali Seul
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredMyItems.map((item) => {
                const categoryMeta = PACKING_CATEGORIES.find((c) => c.id === item.category);
                const IconComponent = CATEGORY_ICONS[item.category] || Package;

                return (
                  <div
                    key={item.id}
                    className={`p-3 md:p-3.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 md:gap-3 group ${
                      item.packed
                        ? 'bg-slate-950/40 border-slate-800/60 text-slate-400 opacity-80'
                        : 'bg-slate-900/90 border-slate-800 hover:border-teal-500/40 text-slate-200'
                    }`}
                  >
                    {/* Checkbox interattiva */}
                    <button
                      onClick={() => handleTogglePacked(item.id)}
                      className="mt-0.5 text-teal-400 shrink-0 transition-transform active:scale-95"
                      title={item.packed ? 'Segna come da mettere' : 'Segna come messo in valigia'}
                    >
                      {item.packed ? (
                        <CheckCircle2 className="w-5 h-5 text-teal-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-600 group-hover:text-teal-400 transition-colors" />
                      )}
                    </button>

                    {/* Dettagli Oggetto */}
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold leading-snug cursor-pointer ${
                            item.packed ? 'line-through text-slate-400' : 'text-white'
                          }`}
                          onClick={() => handleTogglePacked(item.id)}
                        >
                          {item.title}
                        </span>

                        {item.quantity && item.quantity > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-cyan-300 font-bold">
                            x{item.quantity}
                          </span>
                        )}

                        {item.isEssential && (
                          <span
                            title="Oggetto fondamentale per il viaggio"
                            className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold flex items-center gap-0.5"
                          >
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            Essenziale
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans line-clamp-2 md:line-clamp-none">{item.notes}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <IconComponent className="w-3 h-3 text-slate-400" />
                          <span>{categoryMeta?.label || item.category}</span>
                        </span>

                        {/* Selettore rapido Locazione: Zaino, A Mano, Stiva */}
                        <div className="flex items-center gap-1">
                          {PACKING_LOCATIONS.map((loc) => {
                            const isCurrentLoc = (item.location || 'checked') === loc.id;
                            return (
                              <button
                                key={loc.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateItemLocation(item.id, loc.id);
                                }}
                                title={`Metti in ${loc.label}: ${loc.description}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all flex items-center gap-1 border ${
                                  isCurrentLoc
                                    ? `${loc.bgColor} ${loc.borderColor} ${loc.badgeColor} font-bold shadow-xs`
                                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span>{loc.iconEmoji}</span>
                                <span>{loc.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Tasto eliminazione */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors opacity-40 group-hover:opacity-100"
                      title="Rimuovi dalla valigia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: VALIGIE CONDIVISE DAGLI ALTRI PARTECIPANTI                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'shared_lists' && (
        <div className="space-y-5">
          {sharedError && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs">
              <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Impossibile leggere le liste condivise. {sharedError}</span>
            </div>
          )}
          {sharedLists.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-base font-bold text-white">Nessuna valigia condivisa al momento</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Nessun partecipante ha ancora condiviso la propria valigia con te.
                <br />
                Puoi chiedere a Pietro o agli altri 3 amici di aprire la loro scheda{' '}
                <strong className="text-white">"Valigia & Oggetti"</strong> e cliccare su{' '}
                <strong className="text-purple-400">"Condividi lista"</strong> per abilitarti alla visualizzazione!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Condividi per primo la tua lista con loro
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selettore partecipante condiviso */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {sharedLists.map((sList) => {
                  const isSelected = sList.ownerId === selectedSharedOwnerId;
                  const member = group.find((m) => m.id === sList.ownerId);
                  const sTotal = sList.items.length;
                  const sPacked = sList.items.filter((i) => i.packed).length;
                  const sPercent = sTotal > 0 ? Math.round((sPacked / sTotal) * 100) : 0;

                  return (
                    <button
                      key={sList.ownerId}
                      onClick={() => setSelectedSharedOwnerId(sList.ownerId)}
                      className={`p-3 rounded-xl border text-left transition-all shrink-0 min-w-[200px] flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                          {member?.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            ownerDisplayName(sList).slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{ownerDisplayName(sList)}</div>
                          <div className="text-[10px] text-purple-300 font-mono">
                            {sPacked}/{sTotal} pronti ({sPercent}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                        {ownerSlotOf(sList)?.toUpperCase() || 'POSTO'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dettaglio della valigia condivisa selezionata */}
              {currentSharedList && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Sola Lettura · Accesso Autorizzato
                        </span>
                        <span className="text-xs text-slate-400">
                          Ultimo aggiornamento: {new Date(currentSharedList.updatedAt).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">
                        Cosa porta {ownerDisplayName(currentSharedList)} ({currentSharedList.items.length} oggetti)
                      </h3>
                    </div>
                    <div className="text-xs text-slate-400">
                      💡 <em>Puoi copiare qualsiasi oggetto utile direttamente nella tua valigia!</em>
                    </div>
                  </div>

                  {/* Elenco oggetti del compagno */}
                  {currentSharedList.items.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-6 text-center">
                      La lista di {ownerDisplayName(currentSharedList)} è ancora vuota.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {currentSharedList.items.map((item) => {
                        const IconComponent = CATEGORY_ICONS[item.category] || Package;
                        const inMyList = myList.items.some(
                          (i) => i.title.toLowerCase().trim() === item.title.toLowerCase().trim()
                        );

                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                              item.packed
                                ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                                : 'bg-slate-900/90 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="mt-0.5 text-slate-500 shrink-0">
                              {item.packed ? (
                                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </div>

                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-white">{item.title}</span>
                                {item.quantity && item.quantity > 1 && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-purple-300">
                                    x{item.quantity}
                                  </span>
                                )}
                                {item.isEssential && (
                                  <span className="text-[10px] text-amber-400">★</span>
                                )}
                                {item.location && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                    <span>{item.location === 'backpack' ? '🎒' : item.location === 'cabin' ? '🧳' : '✈️'}</span>
                                    <span>{item.location === 'backpack' ? 'Zaino' : item.location === 'cabin' ? 'A mano' : 'Stiva'}</span>
                                  </span>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-[11px] text-slate-400">{item.notes}</p>
                              )}
                            </div>

                            {/* Tasto per copiare l'oggetto nella mia valigia */}
                            <button
                              onClick={() => handleCopyFromShared(item, ownerDisplayName(currentSharedList))}
                              disabled={inMyList}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                                inMyList
                                  ? 'bg-slate-800 text-slate-500 cursor-default'
                                  : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
                              }`}
                              title={inMyList ? 'Già nella tua valigia' : 'Copia questo oggetto nella tua valigia'}
                            >
                              {inMyList ? (
                                <>
                                  <Check className="w-3 h-3 text-teal-400" />
                                  <span>Ce l'hai</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Copia</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 1: CONDIVISIONE LISTA CON GLI ALTRI PARTECIPANTI                    */}
      {/* ========================================================================= */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Condividi la tua lista valigia</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Per impostazione predefinita la tua valigia è <strong>privata</strong>. Seleziona qui sotto quali partecipanti
              del viaggio possono vedere i tuoi oggetti in sola lettura per coordinarsi (ad esempio per phon, caricabatterie e adattatori):
            </p>

            {/* Elenco compagni di viaggio con switch toggle */}
            <div className="space-y-2">
              {group
                .filter((m) => m.id !== currentUser.id)
                .map((member) => {
                  const isShared = myList.sharedWith.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.firstName.slice(0, 1) + member.lastName.slice(0, 1)
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Posto {member.travelerId.slice(1)} ({member.travelerId === 't1' ? 'Pietro 8 notti' : '17 notti'})
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleShareWith(member.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isShared
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isShared ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Condiviso</span>
                          </>
                        ) : (
                          <span>Non condiviso</span>
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Azioni rapide di gruppo */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
              <button
                onClick={handleShareWithAll}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 font-semibold"
              >
                Condividi con tutti ({Math.max(0, group.length - 1)})
              </button>
              <button
                onClick={handleMakePrivate}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                Rendi del tutto privata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 2: INTEGRAZIONI APP (IOS, ANDROID, KEEP, REMINDERS, .ICS)           */}
      {/* ========================================================================= */}
      {isIntegrationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Integrazioni con App iOS & Android</h3>
              </div>
              <button
                onClick={() => setIsIntegrationsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Puoi sincronizzare la tua lista oggetti con le tue app preferite su smartphone (iPhone / Android) o esportarla
              in pochi clic:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* 1. Condivisione di sistema nativa (Web Share API) */}
              <button
                onClick={handleNativeShare}
                className="p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Condividi con app del telefono (Share Sheet)</span>
                    <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded font-mono">
                      iOS & Android
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Apre il menu di condivisione nativo del telefono: invia a Apple Note, Promemoria, WhatsApp, Telegram o Gmail.
                  </p>
                </div>
              </button>

              {/* 2. Google Keep */}
              <button
                onClick={handleOpenKeep}
                className="p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Esporta su Google Keep</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                      Android & Web
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Crea una nuova nota con caselle di controllo direttamente su Google Keep, sincronizzata sul tuo account Google.
                  </p>
                </div>
              </button>

              {/* 3. Sveglia / Promemoria Calendario .ICS (Apple Calendario & Google Calendar) */}
              <button
                onClick={handleDownloadIcs}
                className="p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Scarica Promemoria Sveglia (.ics)</span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                      Apple & Google Cal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Genera un evento al 28 Febbraio (giorno pre-partenza da Malpensa) con 2 allarmi sonori e l'elenco degli oggetti ancora da spuntare.
                  </p>
                </div>
              </button>

              {/* 4. Copia testo ordinato per WhatsApp / Note */}
              <button
                onClick={handleCopyText}
                className="p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Copy className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Copia testo formattato / Markdown</span>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                      Tutti
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Copia l'elenco ordinato per categorie con caselle [ ] o [x], pronto da incollare in Notion, Obsidian, Note o WhatsApp.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 3: AGGIUNGI OGGETTO PERSONALIZZATO                                  */}
      {/* ========================================================================= */}
      {isAddCustomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Nuovo oggetto da portare</h3>
              </div>
              <button
                onClick={() => setIsAddCustomOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome oggetto *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Phon da viaggio, Auricolari wireless, ecc."
                  value={newTitle}
                  maxLength={PACKING_LIMITS.title}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PackingCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    {PACKING_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantità</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Locazione bagaglio *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PACKING_LOCATIONS.map((loc) => {
                    const isSelected = newLocation === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setNewLocation(loc.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                          isSelected
                            ? `${loc.bgColor} ${loc.borderColor} ring-1 ring-teal-500 font-bold`
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{loc.iconEmoji}</span>
                          <span className={`text-xs ${isSelected ? loc.badgeColor : 'text-slate-200'}`}>
                            {loc.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                          {loc.shortLabel === 'Zaino' ? 'Sotto sedile / con te' : loc.shortLabel === 'A mano' ? 'In cabina' : 'Stiva 23 kg'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nota o promemoria (opzionale)</label>
                <input
                  type="text"
                  placeholder="Es. Nel bagaglio a mano, da comprare in aeroporto..."
                  value={newNotes}
                  maxLength={PACKING_LIMITS.notes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isEssentialCheck"
                  checked={newIsEssential}
                  onChange={(e) => setNewIsEssential(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-800 cursor-pointer"
                />
                <label htmlFor="isEssentialCheck" className="text-slate-300 cursor-pointer select-none">
                  Segna come oggetto <strong>essenziale</strong> (stella ★)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                >
                  Aggiungi alla Valigia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
