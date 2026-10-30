import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  new HttpExceptionFilter().catch(exception, host as never);
  return { status, json };
}

describe('HttpExceptionFilter', () => {
  it('tells the user a file is too big instead of an internal error', () => {
    const { status, json } = run(Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 }));
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE', message: expect.stringContaining('grande demais') }) });
  });

  it('answers broken JSON as invalid data', () => {
    const { status } = run(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 }));
    expect(status).toHaveBeenCalledWith(400);
  });
});
