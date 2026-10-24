import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { readPrivacyChoice, savePrivacyChoice } from '../cookie-preferences';

describe('privacy storage choices', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('never presumes permission when choice is missing, corrupt, expired or from another version', () => {
    expect(readPrivacyChoice()).toBeNull();
    localStorage.setItem('ax-privacy-choice', '{bad'); expect(readPrivacyChoice()).toBeNull();
    const now = new Date(); savePrivacyChoice(now);
    expect(readPrivacyChoice(now.getTime() + 181 * 86400000)).toBeNull();
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version: 'old', necessary: true, analytics: false, marketing: false, savedAt: now.toISOString() }));
    expect(readPrivacyChoice()).toBeNull();
  });
  it('records necessary-only choices without modifying the login session', () => {
    localStorage.setItem('oficina-auth', 'session');
    savePrivacyChoice();
    expect(readPrivacyChoice()).toEqual(expect.objectContaining({ version: LEGAL_VERSION, necessary: true, analytics: false, marketing: false }));
    expect(localStorage.getItem('oficina-auth')).toBe('session');
  });
  it('fails closed when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readPrivacyChoice()).toBeNull(); expect(savePrivacyChoice()).toBe(false);
  });
});
