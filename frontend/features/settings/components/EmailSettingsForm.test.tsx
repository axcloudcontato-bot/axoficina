import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { EmailSettingsForm } from './EmailSettingsForm';

const mocks = vi.hoisted(() => ({ update: vi.fn(), test: vi.fn(), email: {} as Record<string, unknown> }));
vi.mock('../hooks/use-settings', () => ({
  useSettings: () => ({ isLoading: false, isError: false, data: { company: { name: 'Oficina', document: '11444777000161', email: 'dono@oficina.com' }, email: mocks.email }, refetch: vi.fn() }),
  useUpdateEmailSettings: () => ({ mutate: mocks.update, isPending: false }),
  useTestEmailSettings: () => ({ mutate: mocks.test, isPending: false }),
}));
vi.mock('../hooks/use-unsaved-settings', () => ({ useUnsavedSettings: () => undefined }));

describe('EmailSettingsForm', () => {
  beforeEach(() => {
    mocks.update.mockReset(); mocks.test.mockReset();
    mocks.email = { host: 'smtp.titan.email', port: 587, secure: false, username: 'dono@oficina.com', passwordConfigured: true, fromEmail: 'dono@oficina.com', enabled: false };
    useAuthStore.setState({ user: { id: 'u1', tenantId: 't1', name: 'Dono', email: 'dono@oficina.com', role: 'ADMIN', permissions: ['settings.view', 'settings.manage'], status: 'active', createdAt: '2026-10-01T00:00:00Z' } as never });
  });

  it('offers only the mail ports and sets SSL to match', async () => {
    const user = userEvent.setup();
    render(<EmailSettingsForm />);
    const port = screen.getByLabelText('Porta');
    expect([...port.querySelectorAll('option')].map(option => option.value)).toEqual(['587', '465', '2525', '25']);
    await user.selectOptions(port, '465');
    expect(screen.getByLabelText('Conexão SSL/TLS direta')).toBeChecked();
    await user.click(screen.getByLabelText('Conexão SSL/TLS direta'));
    expect(screen.getByRole('alert')).toHaveTextContent('A porta 465 usa SSL/TLS direto');
  });

  it('tests the saved configuration before the sending is switched on', async () => {
    const user = userEvent.setup();
    render(<EmailSettingsForm />);
    expect(screen.getByText(/salve sem ativar, faça o teste/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar teste' }));
    expect(mocks.test).toHaveBeenCalledWith({ recipient: 'dono@oficina.com' }, expect.anything());
  });

  it('fills server, port and SSL from the provider and explains its catch', async () => {
    mocks.email = { port: 587, secure: false, passwordConfigured: false, enabled: false };
    const user = userEvent.setup();
    render(<EmailSettingsForm />);
    await user.selectOptions(screen.getByLabelText('Seu provedor de e-mail'), 'titan');
    expect(screen.getByLabelText('Servidor SMTP')).toHaveValue('smtp.titan.email');
    expect(screen.getByLabelText('Porta')).toHaveValue('465');
    expect(screen.getByLabelText('Conexão SSL/TLS direta')).toBeChecked();
    await user.selectOptions(screen.getByLabelText('Seu provedor de e-mail'), 'gmail');
    expect(screen.getByText(/senha de app/)).toBeInTheDocument();
  });
});
