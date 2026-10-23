/**
 * ⚙️ CONFIGURAZIONE FIREBASE — l'unico file da compilare.
 *
 * Dove trovare questi valori:
 *   Console Firebase → ⚙️ Impostazioni progetto → Generali → "Le tue app" → app Web (</>)
 *   → "Configurazione SDK" → copia i valori dell'oggetto `firebaseConfig`.
 *
 * Questi valori NON sono segreti: identificano il progetto e finiscono comunque nel codice del sito.
 * I dati sono protetti dalle regole di sicurezza di Firestore (file `firestore.rules`).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBxIxnC3potyNRt9_Lai8UbdfUJIt_qgLw',
  authDomain: 'seul2027-5edd9.firebaseapp.com',
  projectId: 'seul2027-5edd9',
  storageBucket: 'seul2027-5edd9.firebasestorage.app',
  messagingSenderId: '346131953509',
  appId: '1:346131953509:web:daa5c550433fc90bc4d38c'
};

export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith('INCOLLA_QUI') && !firebaseConfig.projectId.startsWith('INCOLLA_QUI');
