import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Pencil, QrCode, Wifi, X } from 'lucide-react';
import { ACCOMMODATIONS } from '../data/tripData';
import type { AccommodationId } from '../shared/travelerProfile';
import { saveHomeId } from '../map/tripToday';
import {
  CHECKOUT_10_MAR_ITEMS,
  CHECKOUT_19_MAR_ITEMS,
  saveSeoulHome,
  toggleCheckoutCheck,
  useSeoulHome
} from '../services/homeInfoService';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const HEADING_FONT: React.CSSProperties = { fontFamily: "'Outfit', system-ui, sans-serif" };

function escapeWifiField(v: string): string {
  return v.replace(/([\\;,:"])/g, '\\$1');
}

function buildWifiQrPayload(ssid: string, password: string): string {
  if (!password) return `WIFI:T:nopass;S:${escapeWifiField(ssid)};;`;
  return `WIFI:T:WPA;S:${escapeWifiField(ssid)};P:${escapeWifiField(password)};;`;
}

export const SeoulHomeCard: React.FC<{ variant?: 'full' | 'compact' | 'mobile-tab' }> = ({ variant = 'full' }) => {
  const { homeDoc, configured } = useSeoulHome();
  const [showPin, setShowPin] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkoutTab, setCheckoutTab] = useState<'mar10' | 'mar19'>('mar19');
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Form states
  const [confirmedAccId, setConfirmedAccId] = useState<AccommodationId | ''>('');
  const [exactAddress, setExactAddress] = useState('');
  const [exactAddressKo, setExactAddressKo] = useState('');
  const [floorAndUnit, setFloorAndUnit] = useState('');
  const [doorPin, setDoorPin] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [trashRules, setTrashRules] = useState('');
  const [hostNotes, setHostNotes] = useState('');

  useEffect(() => {
    if (!qrOpen || !homeDoc.wifiSsid) return;
    let alive = true;
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(buildWifiQrPayload(homeDoc.wifiSsid, homeDoc.wifiPass), {
          width: 260,
          margin: 2,
          color: { dark: '#04242a', light: '#ffffff' }
        })
      )
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        if (alive) setQrDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [qrOpen, homeDoc.wifiSsid, homeDoc.wifiPass]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField((cur) => (cur === key ? null : cur)), 1600);
    } catch {
      /* niente */
    }
  };

  const startEdit = () => {
    setConfirmedAccId(homeDoc.confirmedAccId ?? '');
    setExactAddress(homeDoc.exactAddress);
    setExactAddressKo(homeDoc.exactAddressKo);
    setFloorAndUnit(homeDoc.floorAndUnit);
    setDoorPin(homeDoc.doorPin);
    setWifiSsid(homeDoc.wifiSsid);
    setWifiPass(homeDoc.wifiPass);
    setTrashRules(homeDoc.trashRules);
    setHostNotes(homeDoc.hostNotes);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const accId = confirmedAccId || null;
    await saveSeoulHome({
      confirmedAccId: accId,
      exactAddress,
      exactAddressKo,
      floorAndUnit,
      doorPin,
      wifiSsid,
      wifiPass,
      trashRules,
      hostNotes
    });
    if (accId) saveHomeId(accId);
    setEditing(false);
  };

  const confirmedAcc = homeDoc.confirmedAccId ? ACCOMMODATIONS.find((a) => a.id === homeDoc.confirmedAccId) : null;
  const hasAnyData = configured || Boolean(confirmedAcc);

  /* ---------- Variante compatta per "Scheda viaggio" (offline) ---------- */
  if (variant === 'compact') {
    if (!hasAnyData) {
      return (
        <p className="text-xs text-slate-400 pt-1">
          PIN porta, Wi-Fi e indirizzo si salvano in Alloggi appena confermata la prenotazione.
        </p>
      );
    }
    return (
      <div className="space-y-2.5 pt-2 border-t border-white/10" data-testid="seoul-home-compact">
        {confirmedAcc && (
          <p className="text-xs font-semibold text-[#52d9e6]">
            Alloggio {confirmedAcc.code} · {confirmedAcc.district}
          </p>
        )}
        {homeDoc.floorAndUnit && (
          <p className="text-sm text-slate-200">
            <span className="text-xs text-slate-400 block">Piano e interno</span>
            {homeDoc.floorAndUnit}
          </p>
        )}
        {homeDoc.exactAddressKo && (
          <p className="text-[15px] text-white break-keep" lang="ko">{homeDoc.exactAddressKo}</p>
        )}
        {homeDoc.doorPin && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#52d9e6]" /> Codice porta
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white tabular-nums" style={HEADING_FONT}>
                {showPin ? homeDoc.doorPin : '••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Nascondi codice porta' : 'Mostra codice porta'}
                className="min-h-11 min-w-11 rounded-lg text-slate-300 hover:text-white flex items-center justify-center"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        {homeDoc.wifiSsid && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-300 truncate">
              <Wifi className="w-3.5 h-3.5 text-[#52d9e6] inline mr-1.5" />
              <b>{homeDoc.wifiSsid}</b>
              {homeDoc.wifiPass && <span className="text-slate-400"> · {homeDoc.wifiPass}</span>}
            </span>
            {homeDoc.wifiPass && (
              <button
                type="button"
                onClick={() => void copy(homeDoc.wifiPass, 'wifi')}
                className="min-h-11 px-2.5 rounded-lg text-[#52d9e6] font-semibold shrink-0"
              >
                {copiedField === 'wifi' ? 'Copiata' : 'Copia'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------- Su desktop, finché nulla è compilato, resta una riga silenziosa ---------- */
  if (variant === 'full' && !hasAnyData && !editing) {
    return (
      <section
        className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5"
        data-testid="seoul-home-card"
      >
        <p className="text-sm text-slate-400">
          <strong className="text-white font-semibold">Casa confermata:</strong> una volta prenotato su Enko Stay, salva qui codice porta, Wi-Fi e indirizzo in coreano per averli offline.
        </p>
        <button
          type="button"
          onClick={startEdit}
          data-keep-style
          className={`min-h-11 px-4 rounded-xl bg-[#101c29] hover:bg-[#152231] text-[#52d9e6] text-sm font-semibold inline-flex items-center gap-2 shrink-0 transition-colors ${FOCUS_RING}`}
          data-testid="seoul-home-edit"
        >
          <Pencil className="w-3.5 h-3.5" /> Inserisci dati casa
        </button>
      </section>
    );
  }

  const checklistItems = checkoutTab === 'mar10' ? CHECKOUT_10_MAR_ITEMS : CHECKOUT_19_MAR_ITEMS;
  const doneCount = checklistItems.filter((i) => homeDoc.checkoutChecks[i.id]).length;
  const isMobileTab = variant === 'mobile-tab';

  const inputStyle: React.CSSProperties = {
    borderRadius: 12,
    background: 'var(--ms-fill, rgba(96,150,214,0.13))'
  };

  return (
    <section
      className={isMobileTab ? 'pt-4 space-y-5' : 'border-b border-slate-800/80 pb-8 space-y-5'}
      data-testid="seoul-home-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium text-[#eaf0f6] leading-tight" style={HEADING_FONT}>
            {confirmedAcc ? `Alloggio ${confirmedAcc.code} · ${confirmedAcc.district}` : 'Dati della casa a Seul'}
          </h2>
          {homeDoc.floorAndUnit ? (
            <p className="mt-1 text-[14px] text-[#97a5b9]">{homeDoc.floorAndUnit}</p>
          ) : (
            <p className="mt-1 text-[13.5px] text-[#97a5b9]">Disponibili anche senza rete per tutti e quattro.</p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            style={{ borderRadius: 12, background: hasAnyData ? 'var(--ms-fill, rgba(96,150,214,0.13))' : '#52d9e6' }}
            className={`alloggi-tap min-h-11 px-4 text-[13.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 ${FOCUS_RING} ${
              hasAnyData ? 'text-[#eaf0f6]' : 'text-[#04242a]'
            }`}
            data-testid="seoul-home-edit"
          >
            <Pencil className="w-3.5 h-3.5" /> {hasAnyData ? 'Modifica' : 'Compila'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4 pt-1" data-testid="seoul-home-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="sh-acc" className="block text-[13px] text-[#97a5b9] mb-1.5">Alloggio confermato</label>
              <select
                id="sh-acc"
                value={confirmedAccId}
                onChange={(e) => setConfirmedAccId(e.target.value as AccommodationId | '')}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] border-0 outline-none ${FOCUS_RING}`}
              >
                <option value="" className="bg-[#0a1119]">Non ancora scelto</option>
                {ACCOMMODATIONS.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#0a1119]">Alloggio {a.code} · {a.district}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sh-floor" className="block text-[13px] text-[#97a5b9] mb-1.5">Piano e interno</label>
              <input
                id="sh-floor"
                value={floorAndUnit}
                onChange={(e) => setFloorAndUnit(e.target.value)}
                placeholder="Es. 3° piano, int. 302"
                maxLength={80}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="sh-addr" className="block text-[13px] text-[#97a5b9] mb-1.5">Indirizzo (inglese o italiano)</label>
              <input
                id="sh-addr"
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                placeholder="Indirizzo ricevuto dopo la conferma"
                maxLength={200}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
              />
            </div>
            <div>
              <label htmlFor="sh-addr-ko" className="block text-[13px] text-[#97a5b9] mb-1.5">Indirizzo in coreano (per i taxi)</label>
              <input
                id="sh-addr-ko"
                value={exactAddressKo}
                onChange={(e) => setExactAddressKo(e.target.value)}
                placeholder="서울특별시 마포구…"
                maxLength={200}
                lang="ko"
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="sh-pin" className="block text-[13px] text-[#97a5b9] mb-1.5">Codice porta</label>
              <input
                id="sh-pin"
                value={doorPin}
                onChange={(e) => setDoorPin(e.target.value)}
                placeholder="Es. *1234*"
                maxLength={60}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] tabular-nums placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
                data-testid="seoul-home-pin-input"
              />
            </div>
            <div>
              <label htmlFor="sh-ssid" className="block text-[13px] text-[#97a5b9] mb-1.5">Rete Wi-Fi</label>
              <input
                id="sh-ssid"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="Es. KT_GiGA_5G"
                maxLength={80}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
              />
            </div>
            <div>
              <label htmlFor="sh-wpass" className="block text-[13px] text-[#97a5b9] mb-1.5">Password Wi-Fi</label>
              <input
                id="sh-wpass"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                placeholder="Password"
                maxLength={100}
                style={inputStyle}
                className={`w-full min-h-11 px-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none ${FOCUS_RING}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="sh-trash" className="block text-[13px] text-[#97a5b9] mb-1.5">Raccolta differenziata</label>
              <textarea
                id="sh-trash"
                rows={2}
                value={trashRules}
                onChange={(e) => setTrashRules(e.target.value)}
                placeholder="Sacchetti del distretto, dove lasciare i rifiuti…"
                maxLength={400}
                style={inputStyle}
                className={`w-full p-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none resize-none ${FOCUS_RING}`}
              />
            </div>
            <div>
              <label htmlFor="sh-notes" className="block text-[13px] text-[#97a5b9] mb-1.5">Note dell’host</label>
              <textarea
                id="sh-notes"
                rows={2}
                value={hostNotes}
                onChange={(e) => setHostNotes(e.target.value)}
                placeholder="Acqua calda, riscaldamento, deposito bagagli…"
                maxLength={400}
                style={inputStyle}
                className={`w-full p-3.5 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]/55 outline-none resize-none ${FOCUS_RING}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              style={{ borderRadius: 12, background: '#52d9e6' }}
              className={`min-h-11 px-5 text-[#04242a] text-[14px] font-semibold transition-colors ${FOCUS_RING}`}
              data-testid="seoul-home-save"
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={inputStyle}
              className={`min-h-11 px-4 text-[14px] font-medium text-[#eaf0f6] transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-0 border-t border-[rgba(234,240,246,0.11)]">
          {!hasAnyData ? (
            <div className="py-5 space-y-3">
              <p className="text-[14.5px] text-[#c3cfdd] leading-relaxed">
                Non ancora compilata. Appena ricevete la conferma Enko Stay, inserite codice porta, Wi-Fi e indirizzo in coreano.
              </p>
            </div>
          ) : (
            <>
              {/* Riga Codice Porta */}
              <div className="py-3.5 border-b border-[rgba(234,240,246,0.11)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[13px] text-[#97a5b9]">Codice porta</span>
                  <span className="mt-0.5 block text-[24px] font-medium text-[#eaf0f6] tabular-nums truncate" style={HEADING_FONT}>
                    {homeDoc.doorPin ? (showPin ? homeDoc.doorPin : '••••••') : '—'}
                  </span>
                </div>
                {homeDoc.doorPin && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? 'Nascondi codice porta' : 'Mostra codice porta'}
                      style={inputStyle}
                      className={`min-h-11 min-w-11 text-[#eaf0f6] grid place-items-center ${FOCUS_RING}`}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(homeDoc.doorPin, 'pin')}
                      aria-label="Copia codice porta"
                      style={inputStyle}
                      className={`min-h-11 min-w-11 text-[#eaf0f6] grid place-items-center ${FOCUS_RING}`}
                    >
                      {copiedField === 'pin' ? <Check className="w-4 h-4 text-[#52d9e6]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Riga Wi-Fi */}
              <div className="py-3.5 border-b border-[rgba(234,240,246,0.11)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[13px] text-[#97a5b9]">Wi-Fi di casa</span>
                  <span className="mt-0.5 block text-[17px] font-medium text-[#eaf0f6] truncate" style={HEADING_FONT}>
                    {homeDoc.wifiSsid || '—'}
                  </span>
                  {homeDoc.wifiPass && (
                    <span className="block text-[13.5px] text-[#97a5b9] tabular-nums truncate">{homeDoc.wifiPass}</span>
                  )}
                </div>
                {homeDoc.wifiSsid && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQrOpen(true)}
                      aria-label="Mostra QR Wi-Fi"
                      style={inputStyle}
                      className={`min-h-11 min-w-11 text-[#52d9e6] grid place-items-center ${FOCUS_RING}`}
                      data-testid="seoul-home-wifi-qr"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    {homeDoc.wifiPass && (
                      <button
                        type="button"
                        onClick={() => void copy(homeDoc.wifiPass, 'wifi')}
                        aria-label="Copia password Wi-Fi"
                        style={inputStyle}
                        className={`min-h-11 min-w-11 text-[#eaf0f6] grid place-items-center ${FOCUS_RING}`}
                      >
                        {copiedField === 'wifi' ? <Check className="w-4 h-4 text-[#52d9e6]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Riga Indirizzo */}
              {(homeDoc.exactAddressKo || homeDoc.exactAddress) && (
                <div className="py-3.5 border-b border-[rgba(234,240,246,0.11)] flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[13px] text-[#97a5b9]">Indirizzo</span>
                    {homeDoc.exactAddressKo && (
                      <p className="text-[17px] font-medium text-[#eaf0f6] break-keep leading-snug" lang="ko">
                        {homeDoc.exactAddressKo}
                      </p>
                    )}
                    {homeDoc.exactAddress && (
                      <p className="text-[13.5px] text-[#97a5b9] leading-snug">{homeDoc.exactAddress}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copy(homeDoc.exactAddressKo || homeDoc.exactAddress, 'addr')}
                    aria-label="Copia indirizzo"
                    style={inputStyle}
                    className={`min-h-11 px-3.5 text-[13px] font-semibold text-[#52d9e6] shrink-0 ${FOCUS_RING}`}
                  >
                    {copiedField === 'addr' ? 'Copiato' : 'Copia'}
                  </button>
                </div>
              )}

              {/* Differenziata e note host */}
              {(homeDoc.trashRules || homeDoc.hostNotes) && (
                <div className="py-3.5 border-b border-[rgba(234,240,246,0.11)] space-y-2 text-[14px] leading-relaxed">
                  {homeDoc.trashRules && (
                    <p className="text-[#c3cfdd]">
                      <strong className="text-[#eaf0f6] font-medium">Differenziata:</strong> {homeDoc.trashRules}
                    </p>
                  )}
                  {homeDoc.hostNotes && (
                    <p className="text-[#c3cfdd]">
                      <strong className="text-[#eaf0f6] font-medium">Note host:</strong> {homeDoc.hostNotes}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Checklist uscita a comparsa */}
          <div className="border-b border-[rgba(234,240,246,0.11)]" data-testid="seoul-home-checkout">
            <button
              type="button"
              onClick={() => setChecklistOpen((v) => !v)}
              aria-expanded={checklistOpen}
              className={`w-full min-h-[54px] py-3 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
            >
              <div>
                <span className="block text-[16px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
                  Controlli prima di lasciare casa
                </span>
                <span className="block text-[13px] text-[#97a5b9]">
                  10 marzo (Pietro) e check-out 19 marzo entro le 07:30
                </span>
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] font-semibold text-[#eaf0f6] tabular-nums">
                  {doneCount}/{checklistItems.length}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#97a5b9] transition-transform duration-200 motion-reduce:transition-none ${
                    checklistOpen ? 'rotate-180 text-[#52d9e6]' : ''
                  }`}
                />
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                checklistOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="pb-4 space-y-3">
                  <div style={inputStyle} className="relative grid grid-cols-2 p-1 max-w-xs" role="tablist" aria-label="Data di uscita">
                    <span
                      aria-hidden="true"
                      style={{
                        borderRadius: 9,
                        background: '#52d9e6',
                        width: 'calc(50% - 4px)',
                        transform: checkoutTab === 'mar19' ? 'translateX(100%)' : 'translateX(0%)'
                      }}
                      className="pointer-events-none absolute top-1 bottom-1 left-1 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    />
                    {(
                      [
                        ['mar10', '10 marzo · Pietro'],
                        ['mar19', '19 marzo · 07:30']
                      ] as const
                    ).map(([id, label]) => {
                      const active = checkoutTab === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setCheckoutTab(id)}
                          className={`relative z-10 min-h-11 px-3 text-[13px] font-semibold transition-colors whitespace-nowrap ${FOCUS_RING} ${
                            active ? 'text-[#04242a]' : 'text-[#eaf0f6]/80'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="divide-y divide-[rgba(234,240,246,0.08)]">
                    {checklistItems.map((item) => {
                      const on = !!homeDoc.checkoutChecks[item.id];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => void toggleCheckoutCheck(item.id)}
                          className={`w-full py-2.5 flex items-start gap-3 text-left min-h-11 ${FOCUS_RING}`}
                        >
                          <span
                            style={{ borderRadius: 6 }}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
                              on ? 'bg-[#52d9e6] border-[#52d9e6] text-[#04242a]' : 'border-white/25 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                          <span className={`text-[14px] leading-snug ${on ? 'line-through text-[#97a5b9]' : 'text-[#eaf0f6]'}`}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {qrOpen &&
        homeDoc.wifiSsid &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="QR Wi-Fi di casa"
            className="alloggi-modal-bg fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-6"
            onClick={() => setQrOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="alloggi-modal-card w-full max-w-xs rounded-2xl bg-white text-slate-950 p-5 text-center space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Inquadra con la fotocamera</span>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  aria-label="Chiudi"
                  className="h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Wi-Fi ${homeDoc.wifiSsid}`} className="mx-auto w-56 h-56 rounded-xl" />
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-slate-500">Generazione QR…</div>
              )}
              <div>
                <div className="text-base font-bold">{homeDoc.wifiSsid}</div>
                {homeDoc.wifiPass && <div className="text-xs font-mono text-slate-600 mt-0.5">{homeDoc.wifiPass}</div>}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};

export default SeoulHomeCard;
