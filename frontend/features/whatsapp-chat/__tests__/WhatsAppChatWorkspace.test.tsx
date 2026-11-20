import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppChatWorkspace } from '../WhatsAppChatWorkspace';

const branding = vi.hoisted(() => ({ current: { isPending: false, data: { whatsappEnabled: true } as { whatsappEnabled: boolean } | undefined } }));
vi.mock('@/features/settings/hooks/use-settings', () => ({ useBranding: () => branding.current }));

describe('WhatsAppChatWorkspace', () => {
  beforeEach(() => { branding.current = { isPending: false, data: { whatsappEnabled: true } }; });

  it('shows the WA-AKG chat inside Ofix when WhatsApp is active', () => {
    render(<WhatsAppChatWorkspace />);
    expect(screen.getByTitle('Conversas do WhatsApp')).toHaveAttribute('src', 'https://chat.axcloud.com.br/dashboard/chat');
    expect(screen.getByRole('link', { name: /Abrir em nova aba/ })).toHaveAttribute('target', '_blank');
  });

  it('sends the workshop to the WhatsApp settings when it is not active', () => {
    branding.current = { isPending: false, data: { whatsappEnabled: false } };
    render(<WhatsAppChatWorkspace />);
    expect(screen.queryByTitle('Conversas do WhatsApp')).toBeNull();
    expect(screen.getByRole('link', { name: 'Configurar WhatsApp' })).toHaveAttribute('href', '/configuracoes/whatsapp');
  });
});
