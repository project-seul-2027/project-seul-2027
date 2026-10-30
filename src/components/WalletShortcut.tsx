import React, { useCallback, useEffect, useState } from 'react';
import { Plane, WalletCards, Pin, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FLIGHT_LEGS, KINDS, legDepartureMs, validityLabel, type WalletItem } from '../wallet/walletData';
import { WALLET_EVENT, WALLET_OPEN_KEY, listItems } from '../wallet/walletStore';
import { formatCountdown } from '../utils/tripClock';

/** In "Oggi": il biglietto del volo imminente e le schede fissate, a un tocco. Non compare se non c'è nulla di utile. */
export const WalletShortcut: React.FC<{ onOpen: () => void; nowMs: number }> = ({ onOpen, nowMs }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WalletItem[]>([]);
  const refresh = useCallback(() => {
    listItems(user!.id).then(setItems).catch(() => setItems([]));
  }, [user]);
  useEffect(() => {
    refresh();
    window.addEventListener(WALLET_EVENT, refresh);
    return () => window.removeEventListener(WALLET_EVENT, refresh);
  }, [refresh]);

  const upcoming = items
    .filter((i) => i.kind === 'flight' && i.legId)
    .map((i) => ({ item: i, dep: legDepartureMs(FLIGHT_LEGS.find((l) => l.id === i.legId)!) }))
    .filter((x) => !Number.isNaN(x.dep) && x.dep - nowMs > -3 * 3_600_000 && x.dep - nowMs < 36 * 3_600_000)
    .sort((a, b) => a.dep - b.dep);
  const expiring = items.filter((i) => i.kind !== 'flight' && validityLabel(i, nowMs)?.tone === 'soon');
  const pinned = items.filter((i) => i.pinned && !upcoming.some((u) => u.item.id === i.id));
  const shown: { item: WalletItem; note: string }[] = [
    ...upcoming.slice(0, 2).map((u) => ({ item: u.item, note: u.dep > nowMs ? `Parte tra ${formatCountdown(u.dep - nowMs)}` : 'In corso' })),
    ...expiring.map((i) => ({ item: i, note: validityLabel(i, nowMs)!.text })),
    ...pinned.map((i) => ({ item: i, note: 'Fissata' }))
  ].filter((x, idx, arr) => arr.findIndex((y) => y.item.id === x.item.id) === idx).slice(0, 3);

  if (shown.length === 0) return null;
  const open = (id: string) => {
    try {
      sessionStorage.setItem(WALLET_OPEN_KEY, id);
    } catch {
      /* archiviazione bloccata: si apre l'elenco */
    }
    onOpen();
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4" data-testid="wallet-shortcut">
      <h3 className="px-1 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><WalletCards className="w-4 h-4 text-cyan-400" /> Wallet</h3>
      <div className="space-y-2">
        {shown.map(({ item, note }) => (
          <button key={item.id} type="button" onClick={() => open(item.id)} className={`w-full min-h-[56px] rounded-2xl bg-gradient-to-br ${KINDS[item.kind].gradient} px-3.5 flex items-center gap-3 text-left`} data-testid="wallet-shortcut-item">
            {item.kind === 'flight' ? <Plane className="w-5 h-5 text-white shrink-0" /> : item.pinned ? <Pin className="w-5 h-5 text-white shrink-0" /> : <WalletCards className="w-5 h-5 text-white shrink-0" />}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white truncate">{item.title}</span>
              <span className="block text-[11px] text-white/80 truncate">{item.subtitle}</span>
            </span>
            <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-black/25 text-white shrink-0">{note}</span>
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
};
