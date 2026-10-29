import { canTransitionAppointment } from './appointment-state-machine';

describe('appointment state machine', () => {
  it('permite o fluxo normal até o início do atendimento', () => {
    expect(canTransitionAppointment('SCHEDULED', 'CONFIRMED')).toBe(true);
    expect(canTransitionAppointment('CONFIRMED', 'IN_SERVICE')).toBe(true);
  });

  it('em atendimento só a OS encerra o agendamento', () => {
    expect(canTransitionAppointment('IN_SERVICE', 'COMPLETED')).toBe(false);
    expect(canTransitionAppointment('IN_SERVICE', 'CANCELLED')).toBe(false);
  });

  it('não permite reabrir estados finais', () => {
    expect(canTransitionAppointment('COMPLETED', 'SCHEDULED')).toBe(false);
    expect(canTransitionAppointment('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(canTransitionAppointment('NO_SHOW', 'CONFIRMED')).toBe(false);
  });
});
