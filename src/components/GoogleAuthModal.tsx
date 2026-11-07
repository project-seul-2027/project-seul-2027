import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ProfileForm } from './auth/ProfileForm';
import { useAuth } from '../auth/AuthContext';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Finestra "Il mio profilo" per l'utente già entrato con Google.
 * La registrazione avviene solo dalla schermata di accesso Google (LoginScreen + OnboardingScreen):
 * qui non esistono altri modi per creare un account.
 */
export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 max-lg:items-end max-lg:p-0 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        className="ms-profile w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col max-lg:max-w-none max-lg:rounded-t-2xl max-lg:rounded-b-none max-lg:border-0 max-lg:bg-[#0a1119] max-lg:shadow-[0_-6px_24px_rgba(0,0,0,0.4)] max-lg:max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 max-lg:px-5 max-lg:pt-5 max-lg:pb-3 border-b border-slate-800 max-lg:border-0 flex items-center justify-between shrink-0">
          <div>
            <h2 id="profile-modal-title" className="text-base font-bold text-white font-display max-lg:font-[Outfit] max-lg:text-[22px] max-lg:font-medium max-lg:text-[#eaf0f6]">
              Il mio profilo viaggiatore
            </h2>
            <p className="text-xs text-slate-400">
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="p-1.5 max-lg:min-w-[44px] max-lg:min-h-[44px] max-lg:flex max-lg:items-center max-lg:justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-lg:px-5 max-lg:pt-2 max-lg:pb-0 overflow-y-auto">
          <ProfileForm mode="edit" onCancel={onClose} />
        </div>
      </div>
    </div>
  );
};
