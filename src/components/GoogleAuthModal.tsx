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
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 id="profile-modal-title" className="text-base font-bold text-white font-display">
              Il mio profilo viaggiatore
            </h2>
            <p className="text-xs text-slate-400">
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <ProfileForm mode="edit" onCancel={onClose} />
        </div>
      </div>
    </div>
  );
};
