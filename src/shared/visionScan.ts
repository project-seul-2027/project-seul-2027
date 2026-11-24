import type { ExpenseCategory, ExpenseCurrency } from '../types/expenses';
import type { ShowLang } from '../data/showLanguage';

export interface GroupDietProfile {
  name: string;
  diet: string;
  allergies: string;
}

export interface MenuDishWarning {
  person: string;
  reason: string;
  severity: 'high' | 'medium';
}

export interface MenuDish {
  /** Nome originale sul menu (coreano o cinese) */
  original: string;
  /** Nome tradotto in italiano */
  italian: string;
  /** Breve spiegazione di ingredienti/preparazione */
  description: string;
  /** Prezzo numerico se visibile sul menu */
  price?: number;
  spicy?: 'none' | 'mild' | 'hot';
  allergens: string[];
  warnings: MenuDishWarning[];
}

export interface MenuScanResult {
  kind: 'menu';
  lang: ShowLang;
  restaurantHint?: string;
  currency?: ExpenseCurrency;
  dishes: MenuDish[];
  notes?: string;
}

export interface ReceiptScanResult {
  kind: 'receipt';
  title: string;
  amount: number;
  currency: ExpenseCurrency;
  category: ExpenseCategory;
  /** Data YYYY-MM-DD se leggibile sullo scontrino */
  date?: string;
  /** Riepilogo breve delle voci per il campo note */
  itemsSummary?: string;
  confidence: 'high' | 'medium' | 'low';
}
