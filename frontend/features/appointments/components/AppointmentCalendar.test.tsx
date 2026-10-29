import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AppointmentResponse } from '@oficina/contracts';
import { AppointmentCalendar } from './AppointmentCalendar';

const date = new Date(2026, 9, 21, 8);
const appointment: AppointmentResponse = { id: 'a1', tenantId: 't1', customerId: 'c1', customerName: 'Maria', vehicleId: 'v1', vehicleBrand: 'Fiat', vehicleModel: 'Uno', vehiclePlate: 'ABC1D23', startsAt: date.toISOString(), endsAt: new Date(2026, 9, 21, 9).toISOString(), serviceDescription: 'Revisão', status: 'SCHEDULED', createdBy: 'u1', createdAt: date.toISOString() };

describe('calendar keyboard navigation', () => {
  it('moves days using arrows and Home/End, with only one day in the Tab sequence', async () => {
    const user = userEvent.setup(); const create = vi.fn();
    render(<AppointmentCalendar date={date} view="MONTH" items={[]} loading={false} onSelect={vi.fn()} onCreate={create} />);
    const days = screen.getAllByRole('button', { name: /Novo agendamento em/ });
    expect(days.filter((day) => day.tabIndex === 0)).toHaveLength(1);
    const index = days.findIndex((day) => day.tabIndex === 0); days[index].focus();
    await user.keyboard('{ArrowRight}{ArrowDown}'); expect(days[index + 8]).toHaveFocus();
    await user.keyboard('{Home}'); expect(days[Math.floor((index + 8) / 7) * 7]).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}'); expect(days.at(-1)).toHaveFocus();
    await user.keyboard('{Enter}'); expect(create).toHaveBeenCalledTimes(1);
  });
  it('activates an appointment with Space and Enter without creating a new appointment', async () => {
    const user = userEvent.setup(); const select = vi.fn(); const create = vi.fn();
    render(<AppointmentCalendar date={date} view="WEEK" items={[appointment]} loading={false} onSelect={select} onCreate={create} />);
    const event = screen.getByRole('button', { name: /Abrir agendamento de Maria/ });
    expect(event.closest('button button')).toBeNull(); event.focus();
    await user.keyboard(' {Enter}'); expect(select).toHaveBeenCalledTimes(2); expect(create).not.toHaveBeenCalled();
  });
  it('keeps every monthly appointment accessible even when a day has more than three', () => {
    render(<AppointmentCalendar date={date} view="MONTH" items={Array.from({ length: 5 }, (_, i) => ({ ...appointment, id: `a${i}` }))} loading={false} onSelect={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Abrir agendamento de Maria/ })).toHaveLength(5);
  });
});

describe('weekly time grid', () => {
  const hours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6] };
  it('hides closed days and creates an appointment at the clicked time', async () => {
    const user = userEvent.setup(); const create = vi.fn();
    render(<AppointmentCalendar date={date} view="WEEK" items={[]} loading={false} hours={hours} onSelect={vi.fn()} onCreate={create} />);
    expect(screen.getAllByRole('button', { name: /Novo agendamento em/ })).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: /Agendar em quarta-feira, 21 de outubro de 2026 às 14:30/ }));
    expect(create).toHaveBeenCalledWith(new Date(2026, 9, 21, 14, 30));
  });
  it('reschedules by dragging, keeping the appointment and passing the new start', () => {
    const move = vi.fn();
    render(<AppointmentCalendar date={date} view="WEEK" items={[appointment]} loading={false} hours={hours} onSelect={vi.fn()} onCreate={vi.fn()} onMove={move} />);
    const event = screen.getByRole('button', { name: /Abrir agendamento de Maria/ });
    expect(event).toHaveAttribute('draggable', 'true');
    const target = screen.getByRole('button', { name: /Agendar em quinta-feira, 22 de outubro de 2026 às 10:00/ });
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(event, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(move).toHaveBeenCalledWith(appointment, new Date(2026, 9, 22, 10, 0));
  });
  it('does not let a finished appointment be dragged', () => {
    render(<AppointmentCalendar date={date} view="WEEK" items={[{ ...appointment, status: 'COMPLETED' }]} loading={false} hours={hours} onSelect={vi.fn()} onCreate={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Abrir agendamento de Maria/ })).toHaveAttribute('draggable', 'false');
  });
});
