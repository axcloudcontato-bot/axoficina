import { HealthController } from './health.controller';

function build({ database = () => Promise.resolve([{ '?column?': 1 }]), redis = () => Promise.resolve('PONG') }: { database?: () => Promise<unknown>; redis?: () => Promise<unknown> } = {}) {
  const prisma = { unscoped: { $queryRaw: jest.fn(() => database()) } };
  const queue = { client: Promise.resolve({ ping: jest.fn(() => redis()) }) };
  const response = { status: jest.fn() };
  return { controller: new HealthController(prisma as never, queue as never), response };
}

describe('HealthController', () => {
  it('answers 200 when the database and Redis respond', async () => {
    const { controller, response } = build();
    const body = await controller.check(response as never);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ status: 'ok', checks: { database: 'ok', redis: 'ok' } });
  });

  it('answers 503 and says which one is out', async () => {
    const { controller, response } = build({ database: () => Promise.reject(new Error('connection refused')) });
    const body = await controller.check(response as never);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(body).toMatchObject({ status: 'error', checks: { database: 'down', redis: 'ok' } });
  });

  it('treats a dependency that hangs as down instead of hanging the check', async () => {
    jest.useFakeTimers();
    try {
      const { controller, response } = build({ redis: () => new Promise(() => undefined) });
      const pending = controller.check(response as never);
      await jest.advanceTimersByTimeAsync(2_000);
      expect(await pending).toMatchObject({ status: 'error', checks: { database: 'ok', redis: 'down' } });
      expect(response.status).toHaveBeenCalledWith(503);
    } finally {
      jest.useRealTimers();
    }
  });
});
