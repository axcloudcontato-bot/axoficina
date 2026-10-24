import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerMessageComposer, type CustomerMessageDraft } from '../CustomerMessageComposer';
import { CUSTOMER_MESSAGE_PRESETS } from '../../customer-message-presets';

vi.mock('@phosphor-icons/react', () => ({ CircleNotch: () => null }));

function Composer() {
  const [value, setValue] = useState<CustomerMessageDraft>({ enabled: true, preset: 'QUOTE', question: CUSTOMER_MESSAGE_PRESETS.QUOTE.question, options: [...CUSTOMER_MESSAGE_PRESETS.QUOTE.options], includeQuote: true });
  return <CustomerMessageComposer value={value} onChange={setValue} disabled={false} />;
}

describe('Customer message composer', () => {
  it('adapts buttons to the question and allows editing a custom answer', async () => {
    const user = userEvent.setup();
    render(<Composer />);
    expect(screen.getByLabelText('Botão 1')).toHaveValue('Aprovar orçamento');
    await user.selectOptions(screen.getByRole('combobox'), 'PICKUP');
    expect(screen.getByLabelText('Botão 1')).toHaveValue('Confirmar retirada');
    expect(screen.getByLabelText('Incluir itens e total do orçamento')).not.toBeChecked();
    await user.selectOptions(screen.getByRole('combobox'), 'CUSTOM');
    await user.type(screen.getByLabelText('Pergunta para o cliente'), 'Pode trazer o veículo amanhã?');
    await user.clear(screen.getByLabelText('Botão 1'));
    await user.type(screen.getByLabelText('Botão 1'), 'Posso levar amanhã');
    expect(screen.getByText('Posso levar amanhã')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Solicitar resposta por botões'));
    expect(screen.queryByLabelText('Pergunta para o cliente')).not.toBeInTheDocument();
  });
});
