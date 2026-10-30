import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

const tracker = (req: Record<string, unknown>) => (ClientIpThrottlerGuard.prototype as unknown as { getTracker: (req: Record<string, unknown>) => Promise<string> }).getTracker(req);

describe('ClientIpThrottlerGuard', () => {
  const original = process.env.CLIENT_IP_HEADER;
  afterEach(() => { process.env.CLIENT_IP_HEADER = original; });

  it('limits each real client separately behind the proxy', async () => {
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';
    await expect(tracker({ ip: '172.18.0.9', headers: { 'cf-connecting-ip': '200.10.20.30' } })).resolves.toBe('200.10.20.30');
    await expect(tracker({ ip: '172.18.0.9', headers: { 'cf-connecting-ip': '200.10.20.30, 10.0.0.1' } })).resolves.toBe('200.10.20.30');
    await expect(tracker({ ip: '172.18.0.9', headers: {} })).resolves.toBe('172.18.0.9');
  });

  it('ignores the header when it is not configured, so it cannot be forged', async () => {
    delete process.env.CLIENT_IP_HEADER;
    await expect(tracker({ ip: '172.18.0.9', headers: { 'cf-connecting-ip': '1.2.3.4' } })).resolves.toBe('172.18.0.9');
  });
});
