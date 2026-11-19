import { LEGAL_VERSION } from '@oficina/contracts';

const STORAGE_KEY = 'ax-privacy-choice';
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
/** Disparado na janela sempre que a escolha muda, para quem carrega scripts opcionais reagir sem recarregar. */
export const PRIVACY_CHOICE_EVENT = 'ax-privacy-choice-change';
export interface PrivacyChoice { version: string; necessary: true; analytics: boolean; marketing: false; savedAt: string }
export function readPrivacyChoice(now = Date.now()): PrivacyChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const choice = JSON.parse(raw) as PrivacyChoice;
    const age = now - Date.parse(choice.savedAt);
    if (choice.version !== LEGAL_VERSION || choice.necessary !== true || typeof choice.analytics !== 'boolean' || choice.marketing !== false || !Number.isFinite(age) || age < 0 || age >= MAX_AGE_MS) return null;
    return choice;
  } catch { return null; }
}
/** Estatísticas só ficam ativas com uma escolha positiva, válida e dentro do prazo. */
export function hasAnalyticsConsent(now = Date.now()): boolean {
  return readPrivacyChoice(now)?.analytics === true;
}
export function savePrivacyChoice(now = new Date(), { analytics = false }: { analytics?: boolean } = {}): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: LEGAL_VERSION, necessary: true, analytics, marketing: false, savedAt: now.toISOString() } satisfies PrivacyChoice));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PRIVACY_CHOICE_EVENT));
    return true;
  } catch { return false; }
}
