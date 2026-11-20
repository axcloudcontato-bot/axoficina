import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppChatWorkspace } from '../WhatsAppChatWorkspace';

const state = vi.hoisted(() => ({
  branding: { isPending: false, data: { whatsappEnabled: true } as { whatsappEnabled: boolean } | undefined },
  search: '',
  permissions: ['customers.view', 'customers.manage'],
  replace: vi.fn(),
}));
const api = vi.hoisted(() => ({ conversations: vi.fn(), messages: vi.fn(), send: vi.fn(), media: vi.fn() }));

vi.mock('@/features/settings/hooks/use-settings', () => ({ useBranding: () => state.branding }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }), useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { role: 'FRONT_DESK', permissions: state.permissions } }) }));
vi.mock('@/features/auth/permissions', () => ({ hasPermission: (_user: unknown, key: string) => state.permissions.includes(key) }));
vi.mock('../whatsapp-chat-api', () => ({ whatsappChatApi: api }));

const maria = { jid: '5511988887777@s.whatsapp.net', phone: '5511988887777', name: 'Maria', customer: { id: 'c1', name: 'Maria Souza' }, lastMessage: { text: 'Bom dia', type: 'TEXT', at: '2026-11-20T13:00:00.000Z' } };
const unknown = { jid: '5511977776666@s.whatsapp.net', phone: '5511977776666', lastMessage: { type: 'IMAGE', at: '2026-11-20T12:00:00.000Z' } };

function renderChat(children: ReactNode = <WhatsAppChatWorkspace />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe('WhatsAppChatWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.branding = { isPending: false, data: { whatsappEnabled: true } };
    state.search = '';
    state.permissions = ['customers.view', 'customers.manage'];
    api.conversations.mockResolvedValue({ conversations: [maria, unknown] });
    api.messages.mockResolvedValue({ conversation: maria, messages: [
      { id: 'K1', fromMe: false, type: 'TEXT', text: 'Meu carro está pronto?', at: '2026-11-20T13:00:00.000Z' },
      { id: 'K2', fromMe: true, type: 'TEXT', text: 'Está sim!', at: '2026-11-20T13:01:00.000Z', status: 'READ' },
    ] });
    api.send.mockResolvedValue({ sent: true });
  });

  it('sends the workshop to the WhatsApp settings when it is not active', () => {
    state.branding = { isPending: false, data: { whatsappEnabled: false } };
    renderChat();
    expect(screen.getByRole('link', { name: 'Configurar WhatsApp' })).toHaveAttribute('href', '/configuracoes/whatsapp');
    expect(api.conversations).not.toHaveBeenCalled();
  });

  it('lists conversations with the customer name, filters customers and opens one', async () => {
    renderChat();
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('(11) 97777-6666')).toBeInTheDocument();
    expect(screen.getByText('Foto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    expect(screen.queryByText('(11) 97777-6666')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Maria Souza/ }));
    expect(state.replace).toHaveBeenCalledWith('/chat?conversa=5511988887777%40s.whatsapp.net', { scroll: false });
  });

  it('shows the open conversation and sends a reply with Enter', async () => {
    state.search = 'conversa=5511988887777%40s.whatsapp.net';
    renderChat();
    expect(await screen.findByText('Meu carro está pronto?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver cliente/ })).toHaveAttribute('href', '/clientes/c1');
    const box = screen.getByLabelText('Mensagem');
    fireEvent.change(box, { target: { value: 'Pode buscar às 17h' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(api.send).toHaveBeenCalledWith('5511988887777@s.whatsapp.net', 'Pode buscar às 17h'));
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('lets a profile without customers.manage read but not send', async () => {
    state.search = 'conversa=5511988887777%40s.whatsapp.net';
    state.permissions = ['customers.view'];
    renderChat();
    expect(await screen.findByText('Está sim!')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mensagem')).toBeNull();
    expect(screen.getByText(/não enviar mensagens/)).toBeInTheDocument();
  });
});
