import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { CalendarRangeSelect } from './calendar-range-select';

describe('shared calendar', () => {
  it('changes a controlled date field and honors its date limits', async () => {
    const user = userEvent.setup();
    function Form() {
      const [date, setDate] = useState('2026-06-04');
      return <Input type="date" aria-label="Data do serviço" min="2026-06-01" max="2026-06-20" value={date} onChange={(event) => setDate(event.target.value)} />;
    }
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    expect(await screen.findByRole('button', { name: /21 de junho de 2026/i }, { timeout: 10_000 })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /17 de junho de 2026/i }));
    expect(screen.getByLabelText('Data do serviço')).toHaveValue('2026-06-17');
  }, 15_000);

  it('keeps the chosen time when moving a datetime field to another day', async () => {
    const user = userEvent.setup();
    function Form() {
      const [value, setValue] = useState('2026-06-04T14:30');
      return <Input type="datetime-local" aria-label="Início" value={value} onChange={(event) => setValue(event.target.value)} />;
    }
    render(<Form />);
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }));
    await user.click(await screen.findByRole('button', { name: /17 de junho de 2026/i }));
    expect(screen.getByLabelText('Início')).toHaveValue('2026-06-17T14:30');
  });

  it('selects a real date interval through the range calendar', async () => {
    const user = userEvent.setup();
    function Filter() {
      const [range, setRange] = useState({ from: '2026-06-04', to: '' });
      return <CalendarRangeSelect from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />;
    }
    render(<Filter />);
    await user.click(screen.getByRole('button', { name: 'Selecionar período no calendário' }));
    await user.click(await screen.findByRole('button', { name: /17 de junho de 2026/i }));
    expect(screen.getByRole('button', { name: 'Selecionar período no calendário' })).toHaveTextContent('04/06/2026 — 17/06/2026');
  });
});
