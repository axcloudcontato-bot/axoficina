import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSupportWorkspace } from './AdminSupportWorkspace';

const mocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));
vi.mock('./support-api', () => ({
  PRIORITY_LABELS: { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' },
  STATUS_LABELS: { OPEN: 'Aberto', IN_PROGRESS: 'Em atendimento', RESOLVED: 'Resolvido' },
  supportApi: { adminList: mocks.list, adminUpdate: mocks.update },
}));

describe('Fila de suporte do SaaS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ total: 1, items: [{ id: 'ticket-1', tenantId: 'shop-1', createdById: 'user-1', tenantName: 'Oficina Alfa', authorName: 'Ana', authorEmail: 'ana@example.invalid', subject: 'Agenda indisponível', description: 'A agenda não abre desde esta manhã.', priority: 'HIGH', status: 'OPEN', response: null, createdAt: '2026-11-03T09:00:00Z' }] });
    mocks.update.mockResolvedValue({ id: 'ticket-1' });
  });

  it('mostra a oficina e permite responder e resolver um chamado', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AdminSupportWorkspace /></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: /Agenda indisponível/ }));
    expect(screen.getByText(/ana@example.invalid/)).toBeVisible();
    await user.selectOptions(screen.getAllByLabelText('Situação')[1], 'RESOLVED');
    await user.type(screen.getByLabelText('Resposta visível para a oficina'), 'A agenda voltou a funcionar. Atualize a página.');
    await user.click(screen.getByRole('button', { name: 'Salvar atendimento' }));
    expect(mocks.update.mock.calls[0][0]).toBe('ticket-1');
    expect(mocks.update.mock.calls[0][1]).toEqual({ status: 'RESOLVED', response: 'A agenda voltou a funcionar. Atualize a página.' });
    expect(await screen.findByText('Chamado atualizado.')).toBeVisible();
  });
});
