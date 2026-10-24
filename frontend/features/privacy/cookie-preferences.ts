import { LEGAL_VERSION } from '@oficina/contracts';

const STORAGE_KEY = 'ax-privacy-choice';
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
interface PrivacyChoice { version: string; necessary: true; analytics: false; marketing: false; savedAt: string }
export function readPrivacyChoice(now = Date.now()): PrivacyChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const choice = JSON.parse(raw) as PrivacyChoice;
    const age = now - Date.parse(choice.savedAt);
    if (choice.version !== LEGAL_VERSION || choice.necessary !== true || choice.analytics !== false || choice.marketing !== false || !Number.isFinite(age) || age < 0 || age >= MAX_AGE_MS) return null;
    return choice;
  } catch { return null; }
}
export function savePrivacyChoice(now = new Date()): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: LEGAL_VERSION, necessary: true, analytics: false, marketing: false, savedAt: now.toISOString() } satisfies PrivacyChoice));
    return true;
  } catch { return false; }
}
