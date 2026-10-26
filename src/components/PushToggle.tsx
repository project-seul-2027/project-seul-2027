import React from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isPushConfigured, usePush } from '../notifications';

interface Props {
  /** menu = riga del menu a tendina (computer); sheet = riquadro grande del pannello "Altro" (telefono) */
  variant: 'menu' | 'sheet';
}

const TEXT = {
  on: { title: 'Notifiche attive', sub: "Ti avviso quando esce un aggiornamento dell'app" },
  off: { title: 'Attiva le notifiche', sub: "Un avviso quando esce un aggiornamento dell'app" },
  denied: { title: 'Notifiche bloccate', sub: 'Riattivale dalle impostazioni del browser o del telefono' },
  'ios-install': { title: 'Notifiche su iPhone', sub: "Prima aggiungi l'app alla Home, poi riaprila da lì" },
  working: { title: 'Un attimo…', sub: '' }
} as const;

/** Interruttore delle notifiche: compare solo se Firebase Cloud Messaging è configurato e il dispositivo le supporta. */
export const PushToggle: React.FC<Props> = ({ variant }) => {
  const { user } = useAuth();
  const { status, error, enable, disable } = usePush(user?.id);

  if (!isPushConfigured || !user || status === 'unsupported') return null;

  const copy = TEXT[status];
  const clickable = status === 'off' || status === 'on';
  const Icon = status === 'working' ? Loader2 : status === 'on' ? BellRing : status === 'off' ? Bell : BellOff;
  const onClick = () => {
    if (status === 'off') void enable();
    else if (status === 'on') void disable();
  };

  const switchEl = clickable || status === 'working' ? (
    <span
      aria-hidden="true"
      className={`relative shrink-0 inline-flex h-5 w-9 rounded-full transition-colors ${status === 'on' ? 'bg-cyan-500' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${status === 'on' ? 'left-[1.125rem]' : 'left-0.5'}`}
      />
    </span>
  ) : null;

  const iconEl = <Icon className={`${variant === 'menu' ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 ${status === 'working' ? 'animate-spin' : ''} ${status === 'on' ? 'text-cyan-400' : ''}`} />;

  if (variant === 'menu') {
    return (
      <div>
        <button
          type="button"
          role="menuitem"
          data-testid="push-toggle"
          disabled={!clickable}
          aria-pressed={status === 'on'}
          onClick={onClick}
          className="w-full text-left p-2 rounded-lg hover:bg-slate-800 disabled:hover:bg-transparent text-slate-300 flex items-center gap-1.5"
        >
          {iconEl}
          <span className="flex-1 min-w-0">
            <span className="block">{copy.title}</span>
            {copy.sub && <span className="block text-[10px] text-slate-500 leading-snug">{copy.sub}</span>}
          </span>
          {switchEl}
        </button>
        {error && <p className="px-2 pb-1 text-[10px] text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="px-4 mt-2.5">
      <button
        type="button"
        data-testid="push-toggle"
        disabled={!clickable}
        aria-pressed={status === 'on'}
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-left text-slate-300 disabled:opacity-80"
      >
        <span className={status === 'on' ? 'text-cyan-400' : 'text-slate-400'}>{iconEl}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold">{copy.title}</span>
          {copy.sub && <span className="block text-[11px] text-slate-500 leading-snug">{copy.sub}</span>}
        </span>
        {switchEl}
      </button>
      {error && <p className="mt-1 px-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
};
