import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { GoogleSignup } from '../GoogleSignup';
import { authApi } from '../../api/auth-api';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api/auth-api', () => ({ authApi: { googleSignup: vi.fn() } }));
vi.mock('../GoogleButton', () => ({ GoogleButton: ({ onCredential }: { onCredential: (value: string) => void }) => <button type="button" onClick={() => onCredential('google-id-token')}>Escolher Google</button> }));

describe('GoogleSignup', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

  it('needs only legal acceptance after choosing Google, then starts workshop setup', async () => {
    vi.mocked(authApi.googleSignup).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'u1', tenantId: 't1', email: 'owner@gmail.com', name: 'Owner', role: 'ADMIN', status: 'active', createdAt: new Date().toISOString(), permissions: [] }, tenant: { id: 't1', name: '', document: 'PENDING_GOOGLE_test', plan: 'completo', status: 'active', createdAt: new Date().toISOString() } });
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><GoogleSignup /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: 'Escolher Google' }));
    expect(screen.queryByLabelText('CPF ou CNPJ')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(authApi.googleSignup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    await waitFor(() => expect(authApi.googleSignup).toHaveBeenCalledWith({ credential: 'google-id-token', acceptedTerms: true, legalVersion: LEGAL_VERSION }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/primeiros-passos'));
  });
});
