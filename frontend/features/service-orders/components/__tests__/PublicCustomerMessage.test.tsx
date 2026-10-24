import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCustomerMessage } from '../PublicCustomerMessage';
import { customerMessagesApi } from '../../api/customer-messages-api';

vi.mock('../../api/customer-messages-api', () => ({ customerMessagesApi: { getPublic: vi.fn(), answer: vi.fn() } }));
vi.mock('@phosphor-icons/react', () => ({ CircleNotch: () => null }));

const message = { companyName: 'Oficina Teste', question: 'Você aprova o orçamento?', options: ['Aprovar orçamento', 'Não aprovar'], message: 'OS #00012\nTotal: R$ 350,00', expiresAt: new Date(Date.now() + 60_000).toISOString() };

describe('Customer reply page', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(customerMessagesApi.getPublic).mockResolvedValue(message); });

  it('preselects an email button but only records after explicit confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(customerMessagesApi.answer).mockResolvedValue({ ...message, selectedOption: 0, answeredAt: new Date().toISOString() });
    render(<PublicCustomerMessage token="test-token" initialOption="0" />);
    const choice = await screen.findByRole('button', { name: 'Aprovar orçamento' });
    expect(choice).toHaveAttribute('aria-pressed', 'true');
    expect(customerMessagesApi.answer).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar resposta' }));
    expect(customerMessagesApi.answer).toHaveBeenCalledWith('test-token', 0);
    expect(await screen.findByRole('status')).toHaveTextContent('Resposta registrada: Aprovar orçamento');
    expect(screen.queryByRole('button', { name: 'Confirmar resposta' })).not.toBeInTheDocument();
  });

  it('requires selecting an available button and ignores invalid URL options', async () => {
    const user = userEvent.setup();
    render(<PublicCustomerMessage token="test-token" initialOption="2" />);
    expect(await screen.findByRole('button', { name: 'Confirmar resposta' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Não aprovar' }));
    expect(screen.getByRole('button', { name: 'Confirmar resposta' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows an expired-link error without allowing submission', async () => {
    vi.mocked(customerMessagesApi.getPublic).mockRejectedValue(new Error('expired'));
    render(<PublicCustomerMessage token="expired-token" />);
    expect(await screen.findByRole('heading', { name: 'Mensagem indisponível' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar resposta' })).not.toBeInTheDocument();
    expect(customerMessagesApi.answer).not.toHaveBeenCalled();
  });

  it('keeps the choice available for retry when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(customerMessagesApi.answer).mockRejectedValue(new Error('offline'));
    render(<PublicCustomerMessage token="test-token" />);
    await user.click(await screen.findByRole('button', { name: 'Não aprovar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar resposta' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Confirmar resposta' })).toBeEnabled();
  });
});
