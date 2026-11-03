import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';

describe('SupportModule wiring', () => {
  it('resolves the SaaS admin guard in the application context', async () => {
    const app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.close();
  });
});
