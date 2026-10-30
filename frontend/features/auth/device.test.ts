import { describe, expect, it } from 'vitest';
import { describeDevice } from './device';

describe('describeDevice', () => {
  it('names the browser and the system a person recognizes', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe('Chrome em Windows');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge em Windows');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1')).toBe('Safari em iPhone');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36')).toBe('Chrome em Android');
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0')).toBe('Firefox em Mac');
  });

  it('does not invent a device it cannot read', () => {
    expect(describeDevice(null)).toBe('Aparelho desconhecido');
    expect(describeDevice('curl/8.0')).toBe('Aparelho desconhecido');
  });
});
