import React, { useId } from 'react';

/**
 * Logo del sito: skyline di Seul (Torre N sul monte Namsan, Lotte World Tower, montagne sullo sfondo)
 * con un piccolo aereo in volo. Stessa grafica dell'icona del browser (index.html).
 */
export const BrandIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `brand-sky-${uid}`;
  const clipId = `brand-clip-${uid}`;
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_4px_10px_rgba(34,211,238,0.25)]`} role="img" aria-label="Seul 2027">
      <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e1b4b"/><stop offset="0.55" stopColor="#155e75"/><stop offset="1" stopColor="#67e8f9"/></linearGradient><clipPath id={clipId}><rect width="64" height="64" rx="14"/></clipPath></defs><g clipPath={`url(#${clipId})`}><rect width="64" height="64" fill={`url(#${gradId})`}/><circle cx="41" cy="9" r="2.6" fill="#fde68a" opacity="0.9"/><path d="M0 44 L6 38 L10 41 L16 33 L21 39 L27 35 L33 41 L40 36 L46 40 L52 34 L58 39 L64 36 V64 H0Z" fill="#134e6b" opacity="0.85"/><path d="M0 64 V50 Q5 43 13 42 Q19 41 24 45 Q29 49 33 55 L36 64Z" fill="#0b2a3f"/><rect x="17.2" y="24" width="1.6" height="19" fill="#0f172a"/><path d="M14.6 31.6 Q18 29 21.4 31.6 L20.6 34 H15.4Z" fill="#0f172a"/><rect x="15.8" y="26.4" width="4.4" height="2.4" rx="1.1" fill="#0f172a"/><rect x="17.7" y="14" width="0.6" height="11" fill="#0f172a"/><circle cx="18" cy="13.6" r="1.1" fill="#f472b6"/><path d="M45.6 64 L48.4 26 L50.8 10 L52 10 L54.4 26 L57.2 64Z" fill="#0f172a"/><path d="M50.8 10 L52 10 L52.3 14 L50.5 14Z" fill="#fde68a" opacity="0.9"/><rect x="36" y="38" width="6" height="26" fill="#0f172a"/><rect x="37" y="36" width="4" height="2" fill="#0f172a"/><g fill="#0f172a"><rect x="0" y="52" width="6" height="12"/><rect x="7" y="55" width="5" height="9"/><rect x="25" y="53" width="5" height="11"/><rect x="31" y="49" width="4" height="15"/><rect x="42.5" y="49" width="3.5" height="15"/><rect x="58" y="50" width="6" height="14"/></g><g fill="#fde68a" opacity="0.8"><rect x="38" y="42" width="1" height="1"/><rect x="38" y="47" width="1" height="1"/><rect x="38" y="52" width="1" height="1"/><rect x="50.7" y="30" width="0.9" height="0.9"/><rect x="50.3" y="38" width="0.9" height="0.9"/><rect x="51" y="46" width="0.9" height="0.9"/><rect x="50.4" y="54" width="0.9" height="0.9"/><rect x="2" y="56" width="1" height="1"/><rect x="26.5" y="57" width="1" height="1"/><rect x="32.5" y="54" width="1" height="1"/><rect x="60" y="55" width="1" height="1"/></g><rect x="7" y="18.6" width="17" height="0.7" rx="0.35" fill="#fff" opacity="0.3"/><g transform="translate(24 17)"><path d="M0 0.2 L1.8 0.2 L3.2 2 L0 2Z" fill="#e2e8f0"/><rect x="1" y="1.6" width="11" height="2.6" rx="1.3" fill="#f8fafc"/><path d="M11 1.8 Q13.4 2 13.8 3 Q13.2 4 11.5 4Z" fill="#f8fafc"/><path d="M5 3.8 L8.6 3.8 L6.4 7 L4.6 7Z" fill="#cbd5e1"/></g></g>
    </svg>
  );
};
