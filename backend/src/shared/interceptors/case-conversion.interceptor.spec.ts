import { StreamableFile, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { CaseConversionInterceptor } from './case-conversion.interceptor';

function handlerReturning(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

describe('CaseConversionInterceptor', () => {
  const interceptor = new CaseConversionInterceptor();
  const context = {} as ExecutionContext;

  it('converts a plain object response from camelCase to snake_case', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReturning({ serviceOrderId: 'so-1', vehiclePlate: 'ABC1D23' })),
    );

    expect(result).toEqual({ service_order_id: 'so-1', vehicle_plate: 'ABC1D23' });
  });

  it('passes a StreamableFile through untouched instead of serializing its internals (regression: photo download returned JSON instead of bytes)', async () => {
    const file = new StreamableFile(Buffer.from('fake-image-bytes'));

    const result = await firstValueFrom(interceptor.intercept(context, handlerReturning(file)));

    expect(result).toBe(file);
  });

  it('passes through primitives and null untouched', async () => {
    expect(await firstValueFrom(interceptor.intercept(context, handlerReturning(null)))).toBeNull();
    expect(await firstValueFrom(interceptor.intercept(context, handlerReturning('ok')))).toBe('ok');
  });
});
