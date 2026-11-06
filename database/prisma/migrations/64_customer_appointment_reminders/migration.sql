-- Recusa individual dos lembretes automáticos de agendamento. Todos continuam recebendo até a oficina registrar a recusa.
ALTER TABLE "customers" ADD COLUMN "appointment_reminders_enabled" BOOLEAN NOT NULL DEFAULT true;
