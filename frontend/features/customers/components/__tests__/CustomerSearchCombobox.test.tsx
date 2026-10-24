import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerSearchCombobox } from '../CustomerSearchCombobox';
import { customersApi } from '../../api/customers-api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

vi.mock('../../api/customers-api', () => ({ customersApi: { list: vi.fn() } }));
const customer = { id: 'c1', tenantId: 't1', type: 'PF' as const, name: 'Maria', document: '', phone: '11999999999', createdAt: '2026-10-24T00:00:00Z' };
function renderWithClient(ui: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>); }

describe('customer search keyboard', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(customersApi.list).mockResolvedValue({ items: [customer, { ...customer, id: 'c2', name: 'Mariana' }], total: 2, offset: 0, limit: 20, hasMore: false }); });
  it('announces the active option, selects with Enter without submitting, and keeps options out of Tab order', async () => {
    const user = userEvent.setup(); const changed = vi.fn(); const submitted = vi.fn();
    renderWithClient(<form onSubmit={(event) => { event.preventDefault(); submitted(); }}><CustomerSearchCombobox value="" onChange={changed} aria-label="Cliente" /><button>Salvar</button></form>);
    const input = screen.getByRole('combobox'); await user.type(input, 'Ma');
    const options = await screen.findAllByRole('option');
    expect(options.every((option) => option.tabIndex === -1)).toBe(true);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('{Enter}');
    expect(changed).toHaveBeenLastCalledWith('c2', expect.objectContaining({ name: 'Mariana' }));
    expect(submitted).not.toHaveBeenCalled(); expect(input).toHaveFocus(); expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.tab(); expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus();
  });
  it('first Escape closes even a loading popup and second Escape closes the containing dialog', async () => {
    vi.mocked(customersApi.list).mockReturnValue(new Promise(() => {}));
    function Harness() { const [open, setOpen] = useState(true); return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Formulário</DialogTitle><DialogDescription>Dados de teste.</DialogDescription><CustomerSearchCombobox value="" onChange={vi.fn()} aria-label="Cliente" /></DialogContent></Dialog>; }
    const user = userEvent.setup(); renderWithClient(<Harness />);
    const input = screen.getByRole('combobox'); await user.type(input, 'Ma');
    await screen.findByText('Buscando clientes...');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false'); expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('keeps typed characters when replacing a previously selected customer in a controlled form', async () => {
    function Harness() { const [value, setValue] = useState('c1'); return <CustomerSearchCombobox value={value} initialLabel="Maria" onChange={setValue} aria-label="Cliente" />; }
    const user = userEvent.setup(); renderWithClient(<Harness />);
    const input = screen.getByRole('combobox'); await user.click(input); await user.keyboard('{Control>}a{/Control}'); await user.keyboard('Ma');
    expect(input).toHaveValue('Ma'); await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}'); expect(input).toHaveValue('Mariana');
  });
});
