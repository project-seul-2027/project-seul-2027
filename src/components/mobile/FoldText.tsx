import React, { useState } from 'react';

/**
 * Testo lungo: sul telefono mostra due righe e «Leggi tutto»; sul computer è sempre intero.
 * Serve a non spingere il contenuto in basso con introduzioni lunghe.
 */
export const FoldText: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className={`${className} ${open ? '' : 'max-lg:line-clamp-2'}`}>{children}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lg:hidden min-h-[36px] text-xs font-semibold text-app-accent"
      >
        {open ? 'Mostra meno' : 'Leggi tutto'}
      </button>
    </div>
  );
};
