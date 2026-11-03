import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportWorkspace } from './SupportWorkspace';

const mocks = vi.hoisted(() => ({ mine: vi.fn(), create: vi.fn() }));
vi.mock('./support-api', () => ({
  PRIORITY_LABELS: { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' },
  STATUS_LABELS: { OPEN: 'Aberto', IN_PROGRESS: 'Em atendimento', RESOLVED: 'Resolvido' },
  supportApi: { mine: mocks.mine, create: mocks.create },
}));

describe('Suporte da oficina', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mine.mockResolvedValue({ total: 1, items: [{ id: '1', subject: 'Problema resolvido', description: 'Não conseguia abrir a agenda.', priority: 'NORMAL', status: 'RESOLVED', response: 'A agenda foi corrigida para sua conta.', respondedAt: '2026-11-03T10:00:00Z', createdAt: '2026-11-03T09:00:00Z' }] });
    mocks.create.mockResolvedValue({ id: '2' });
  });

  it('mostra a resposta e envia um chamado com a prioridade escolhida', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SupportWorkspace /></QueryClientProvider>);
    expect(await screen.findByText('A agenda foi corrigida para sua conta.')).toBeVisible();
    await user.type(screen.getByLabelText('Assunto'), 'Falha ao salvar orçamento');
    await user.selectOptions(screen.getByLabelText('Prioridade'), 'HIGH');
    await user.type(screen.getByLabelText('Descrição'), 'Ao clicar em salvar, a tela fica carregando e não conclui.');
    await user.click(screen.getByRole('button', { name: 'Enviar chamado' }));
    expect(mocks.create.mock.calls[0][0]).toEqual({ subject: 'Falha ao salvar orçamento', description: 'Ao clicar em salvar, a tela fica carregando e não conclui.', priority: 'HIGH' });
    expect(await screen.findByText('Chamado #2 aberto. Você pode acompanhá-lo nesta página.')).toBeVisible();
  });
});
