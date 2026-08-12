-- Structured commercial scope and reusable proposal terms.
-- JSONB modules preserve the distinction between included and excluded work,
-- while the remaining narrative fields stay intentionally Markdown-friendly.

alter table public.proposals
  add column if not exists scope_modules jsonb,
  add column if not exists deliverables text,
  add column if not exists acceptance_criteria text,
  add column if not exists payment_schedule text not null default 'half_half',
  add column if not exists payment_terms text not null default
    'El 50 % del importe se abonará a la aceptación de la propuesta y el 50 % restante a la entrega.',
  add column if not exists change_management_terms text not null default
    'Las solicitudes que excedan el alcance descrito se analizarán y, si procede, se presentarán como una ampliación de alcance y presupuesto antes de ejecutarse.';

alter table public.proposals
  drop constraint if exists proposals_payment_schedule_check;

alter table public.proposals
  add constraint proposals_payment_schedule_check
  check (payment_schedule in ('upfront', 'half_half', '30_40_30', 'custom'));

comment on column public.proposals.scope_modules is
  'Ordered JSONB modules: title, description, included[], excluded[] and notes. Used in proposals and delivery prompts.';
comment on column public.proposals.deliverables is
  'Markdown description of the proposal deliverables.';
comment on column public.proposals.acceptance_criteria is
  'Markdown acceptance criteria agreed with the client.';
comment on column public.proposals.payment_schedule is
  'Payment template selection: upfront, half_half, 30_40_30 or custom.';
comment on column public.proposals.payment_terms is
  'Client-facing, editable payment terms generated from payment_schedule.';
comment on column public.proposals.change_management_terms is
  'Client-facing, editable process for requests outside the agreed scope.';