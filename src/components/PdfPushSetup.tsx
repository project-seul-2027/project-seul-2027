import React, { useState } from 'react';
import { pdfPushTrigger } from '../services/pdfPushTrigger';

/** Solo per il Posto 1: attiva l'avviso immediato ai telefoni dopo il caricamento di un PDF. */
export const PdfPushSetup: React.FC = () => {
  const [token, setToken] = useState(() => pdfPushTrigger.getToken());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (token) {
    return (
      <p className="text-[13px] leading-snug text-[#97a5b9]" data-testid="pdf-push-on">
        Avviso immediato ai telefoni attivo su questo dispositivo.{' '}
        <button
          type="button"
          className="font-semibold text-[#52d9e6]"
          onClick={() => {
            pdfPushTrigger.clearToken();
            setToken('');
          }}
        >
          Disattiva
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <p className="text-[13px] leading-snug text-[#97a5b9]" data-testid="pdf-push-off">
        I telefoni ricevono l’avviso del nuovo PDF solo con il controllo programmato, ogni poche ore.{' '}
        <button type="button" className="font-semibold text-[#52d9e6]" onClick={() => setOpen(true)}>
          Attiva l’avviso immediato
        </button>
      </p>
    );
  }

  return (
    <div className="text-[13px] leading-snug text-[#97a5b9]" data-testid="pdf-push-form">
      <p>
        Su GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens. Repository: solo{' '}
        <b className="font-semibold text-[#eaf0f6]">project-seul-2027</b>, permesso{' '}
        <b className="font-semibold text-[#eaf0f6]">Actions: Read and write</b>. Incolla qui il token: resta solo su questo dispositivo.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="password"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="github_pat_…"
          aria-label="Token GitHub"
          className="min-w-0 flex-1 h-10 rounded-xl border-0 bg-[rgba(96,150,214,0.13)] px-3 text-[14px] text-[#eaf0f6] placeholder:text-[#97a5b9]"
        />
        <button
          type="button"
          disabled={text.trim().length < 20}
          className="h-10 rounded-xl bg-[#52d9e6] px-4 text-[14px] font-semibold text-[#04242a] disabled:opacity-40"
          onClick={() => {
            pdfPushTrigger.setToken(text);
            setToken(pdfPushTrigger.getToken());
            setText('');
            setOpen(false);
          }}
        >
          Salva
        </button>
      </div>
    </div>
  );
};
