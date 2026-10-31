import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard } from './OnboardingWizard';

const mocks = vi.hoisted(() => ({
  company: vi.fn(), agenda: vi.fn(), defaults: vi.fn(), complete: vi.fn(), replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/features/settings/hooks/use-settings', () => ({
  useSettings: () => ({ data: { company: { name: 'Oficina Boa', document: '11444777000161' } }, isError: false }),
  useBranding: () => ({ data: { agendaHours: { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: null }, orderDefaults: { defaultWarrantyDays: null, quoteValidityDays: null, documentTerms: null, acceptedPaymentMethods: [] }, onboardingCompleted: false }, isError: false }),
  useUpdateCompanySettings: () => ({ mutateAsync: mocks.company, isPending: false }),
  useUpdateAgendaHours: () => ({ mutateAsync: mocks.agenda, isPending: false }),
  useUpdateOrderDefaults: () => ({ mutateAsync: mocks.defaults, isPending: false }),
  useCompleteOnboarding: () => ({ mutateAsync: mocks.complete, isPending: false }),
}));

describe('OnboardingWizard', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.company.mockResolvedValue({}); mocks.agenda.mockResolvedValue({}); mocks.defaults.mockResolvedValue({}); mocks.complete.mockResolvedValue({ onboardingCompleted: true }); });

  it('holds each screen until what it needs is filled, then saves and moves on', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    expect(await screen.findByText('Passo 1 de 6: Sua oficina')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await waitFor(() => expect(mocks.company).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Passo 2 de 6: Contato')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('telefone ou WhatsApp');
    expect(screen.getByText('Passo 2 de 6: Contato')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Telefone'), '1133334444');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByText('Passo 3 de 6: Endereço')).toBeInTheDocument();
  });

  it('refuses an invalid CPF/CNPJ on the first screen', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    const document = await screen.findByLabelText(/CPF\/CNPJ/);
    await user.clear(document);
    await user.type(document, '123');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('CPF/CNPJ não é válido');
    expect(mocks.company).not.toHaveBeenCalled();
  });

  it('goes through every screen, saves the hours and documents, and closes the setup at the end', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await user.click(await screen.findByRole('button', { name: 'Avançar' }));
    await user.type(await screen.findByLabelText('Telefone'), '1133334444');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await user.type(await screen.findByLabelText(/^Rua/), 'Rua das Flores');
    await user.type(screen.getByLabelText(/^Cidade/), 'São Paulo');
    await user.type(screen.getByLabelText(/^UF/), 'sp');
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(await screen.findByText('Passo 4 de 6: Funcionamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await waitFor(() => expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({ openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: null })));
    expect(await screen.findByText('Passo 5 de 6: Documentos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avançar' }));
    await waitFor(() => expect(mocks.defaults).toHaveBeenCalledWith({ defaultWarrantyDays: 90, quoteValidityDays: 7, documentTerms: null, acceptedPaymentMethods: [] }));
    expect(await screen.findByText('Tudo pronto!')).toBeInTheDocument();
    expect(screen.getByText(/Rua das Flores/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar no sistema' }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalled());
    expect(mocks.replace).toHaveBeenCalledWith('/painel');
  });

  it('shows why a screen could not be saved and stays on it', async () => {
    mocks.company.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await user.click(await screen.findByRole('button', { name: 'Avançar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(screen.getByText('Passo 1 de 6: Sua oficina')).toBeInTheDocument();
  });
});
