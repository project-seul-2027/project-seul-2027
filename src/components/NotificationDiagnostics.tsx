import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BellRing, CheckCircle2, ChevronDown, Loader2, RefreshCw, Smartphone, Wrench } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  enablePush,
  inspectClosedAppPushTest,
  inspectPushRegistration,
  repairPushRegistration,
  scheduleClosedAppPushTest,
  type PushDiagnosticReport
} from '../notifications';

export const NotificationDiagnostics: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<PushDiagnosticReport | null>(null);
  const [busy, setBusy] = useState<'check' | 'repair' | 'enable' | 'test' | null>('check');
  const [message, setMessage] = useState<string | null>(null);
  const [showFullReset, setShowFullReset] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy('check');
    setMessage(null);
    try {
      const [nextReport, closedTest] = await Promise.all([inspectPushRegistration(user.id), inspectClosedAppPushTest()]);
      setReport(nextReport);
      if (closedTest === 'received') setMessage('Prova riuscita: la notifica è arrivata mentre l’app era chiusa.');
      else if (closedTest === 'missing') {
        setMessage('La prova non è arrivata entro 30 secondi. Rinnova il collegamento e riprova; se non basta, segui la reinstallazione completa qui sotto.');
        setShowFullReset(true);
      }
      else if (closedTest === 'waiting') setMessage('Prova programmata: chiudi ora l’app e riaprila dopo almeno 20 secondi.');
    } catch {
      setMessage('Non riesco a controllare questo dispositivo. Verifica la connessione e riprova.');
    } finally {
      setBusy(null);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  if (!user) return null;

  const enable = async () => {
    setBusy('enable');
    setMessage(null);
    try {
      const status = await enablePush(user.id);
      setMessage(status === 'on' ? 'Notifiche attivate su questo dispositivo.' : 'Il permesso non è stato concesso.');
      setReport(await inspectPushRegistration(user.id));
    } catch {
      setMessage('Attivazione non riuscita. Riprova con una connessione stabile.');
    } finally {
      setBusy(null);
    }
  };

  const repair = async () => {
    setBusy('repair');
    setMessage(null);
    try {
      setReport(await repairPushRegistration(user.id));
      setMessage('Collegamento push rinnovato. Ora esegui la prova ad app chiusa.');
    } catch {
      setMessage('Non sono riuscito a rinnovare il collegamento. Segui la reinstallazione completa qui sotto.');
      setShowFullReset(true);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    try {
      await scheduleClosedAppPushTest();
      setMessage('Prova programmata fra 8 secondi. Chiudi ora l’app e riaprila dopo aver ricevuto la notifica.');
    } catch {
      setMessage('La prova non è partita. Aggiorna la registrazione e riprova.');
    } finally {
      setBusy(null);
    }
  };

  const mainAction = report?.canEnable ? { label: 'Attiva notifiche', action: enable, kind: 'enable' as const }
    : report?.canRepair ? { label: report.ready ? 'Rinnova collegamento' : 'Ripara collegamento', action: repair, kind: 'repair' as const }
    : null;

  return (
    <section className="pb-6" aria-labelledby="push-diagnostics-title">
      <div className="flex items-start gap-3 py-4">
        <span className={`mt-0.5 ${report?.ready ? 'text-[#52d9e6]' : 'text-amber-300'}`}>
          {busy === 'check' ? <Loader2 className="h-5 w-5 animate-spin" /> : report?.ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h3 id="push-diagnostics-title" className="text-base font-medium text-white">
            {busy === 'check' ? 'Controllo in corso' : report?.ready ? 'Questo telefono è pronto' : 'C’è qualcosa da sistemare'}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Controlla l’intero percorso delle notifiche e prova la ricezione reale con l’app in background.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-800/80 border-y border-slate-800/80">
        {report?.items.map((item) => {
          const Icon = item.state === 'ok' ? CheckCircle2 : AlertCircle;
          return (
            <div key={item.id} className="flex items-start gap-3 py-3.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.state === 'ok' ? 'text-[#52d9e6]' : item.state === 'warning' ? 'text-amber-300' : 'text-rose-300'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{item.label}</p>
                <p className="mt-0.5 text-sm leading-snug text-slate-400">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {mainAction && (
          <button type="button" onClick={() => void mainAction.action()} disabled={busy !== null} className="min-h-[48px] rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a] disabled:opacity-60">
            <span className="flex items-center justify-center gap-2">
              {busy === mainAction.kind ? <Loader2 className="h-4 w-4 animate-spin" /> : mainAction.kind === 'enable' ? <BellRing className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
              {mainAction.label}
            </span>
          </button>
        )}
        <button type="button" onClick={() => void test()} disabled={!report?.ready || busy !== null} className="min-h-[48px] rounded-xl bg-[#152231] px-4 text-sm font-semibold text-slate-100 disabled:opacity-40">
          <span className="flex items-center justify-center gap-2">
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Prova ad app chiusa
          </span>
        </button>
        <button type="button" onClick={() => void refresh()} disabled={busy !== null} className="min-h-[44px] px-4 text-sm font-medium text-slate-400 disabled:opacity-50 sm:col-span-2">
          <span className="flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4" /> Controlla di nuovo</span>
        </button>
      </div>
      {message && <p className="mt-3 rounded-xl bg-[#152231] px-4 py-3 text-sm leading-relaxed text-slate-200" role="status" aria-live="polite">{message}</p>}

      <div className="mt-4 border-t border-slate-800/80 pt-3">
        <button
          type="button"
          aria-expanded={showFullReset}
          onClick={() => setShowFullReset((open) => !open)}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-sm font-medium text-slate-300"
        >
          Reinstallazione completa
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showFullReset ? 'rotate-180' : ''}`} />
        </button>
        {showFullReset && (
          <div className="pb-2 text-sm leading-relaxed text-slate-400">
            <p>Usala solo se la prova continua a non arrivare dopo aver rinnovato il collegamento.</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Rimuovi Seul 2027 dalla schermata Home.</li>
              <li>Cancella i dati di <span className="text-slate-200">project-seul-2027.github.io</span> dalle impostazioni di {report?.platform === 'ios' ? 'Safari' : 'Chrome'}.</li>
              <li>Apri nuovamente il sito dal browser.</li>
              <li>Aggiungilo alla schermata Home.</li>
              <li>Aprilo dalla nuova icona e attiva le notifiche.</li>
            </ol>
            <p className="mt-3">Questi passaggi richiedono conferme del telefono e non possono essere eseguiti automaticamente dall’app.</p>
          </div>
        )}
      </div>
    </section>
  );
};
