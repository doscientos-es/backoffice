-- Each proposal owns its contractual annex. Existing proposals retain the
-- current standard terms, while new proposals receive the same editable value.
alter table public.proposals
  add column if not exists legal_terms text not null default $$1. **Contrato y alcance.** La aceptación electrónica de esta propuesta, junto con sus anexos y condiciones particulares, formaliza el encargo entre Doscientos y el Cliente. Solo están incluidos los trabajos y entregables descritos expresamente; cualquier cambio requerirá una aceptación previa por escrito y, en su caso, presupuesto adicional.

2. **Precio, facturación y vencimientos.** Los importes, impuestos y calendario de pago son los indicados en esta propuesta. El Cliente abonará cada plazo en la fecha o al cumplirse el hito previsto. Si un plazo no tuviera fecha concreta, vencerá a los 30 días naturales de la recepción de la factura, salvo que una norma imperativa establezca otro cómputo. Entre empresas, ningún aplazamiento podrá superar el máximo legal aplicable.

3. **Mora, suspensión y resolución.** Desde el día siguiente al vencimiento, los importes impagados devengarán los intereses de demora y la compensación por costes de cobro previstos por la normativa aplicable; en operaciones comerciales, se aplicará la Ley 3/2004. Doscientos podrá, previo aviso escrito, suspender los trabajos, accesos, soporte y entregas mientras haya importes vencidos; los plazos se ampliarán en la misma medida. Si el impago persiste tras un requerimiento escrito que conceda un plazo razonable de subsanación, Doscientos podrá resolver el encargo y exigir los importes vencidos, el trabajo realizado y los compromisos no cancelables asumidos frente a terceros.

4. **Entrega y validación.** Doscientos comunicará la disponibilidad de cada entregable. El Cliente profesional deberá revisarlo frente a los criterios de aceptación pactados y comunicar por escrito, con detalle suficiente, las no conformidades verificables en un máximo de 10 días hábiles; dicho proceso no excederá de 30 días naturales. Las observaciones ajenas al alcance, los cambios de preferencia o la decisión de no utilizar el entregable no constituyen una no conformidad ni suspenden el pago. La puesta en producción o uso efectivo del entregable supondrá su aceptación. Los derechos imperativos de consumidores y usuarios no quedan limitados por esta cláusula.

5. **Cancelación por el Cliente.** El Cliente podrá solicitar la terminación anticipada por escrito. En ese caso se liquidarán el trabajo efectivamente realizado y documentado hasta la fecha, los gastos de terceros no cancelables y los costes razonables e inevitables de recursos ya reservados que no puedan reasignarse. Los importes ya pagados se imputarán a esa liquidación y se devolverá cualquier exceso que resulte a favor del Cliente. Tras una entrega conforme, la decisión posterior de no continuar, no publicar o no utilizar el trabajo no libera al Cliente del pago de los importes devengados.

6. **Propiedad intelectual.** Una vez abonado íntegramente el precio, Doscientos cede al Cliente los derechos de explotación necesarios sobre los desarrollos creados específicamente para este proyecto —reproducción, distribución, comunicación pública y transformación— para cualquier territorio y durante el máximo plazo legal. Quedan excluidos y seguirán siendo titularidad de Doscientos sus herramientas, bibliotecas, plantillas, componentes genéricos, metodologías, conocimientos previos y mejoras reutilizables, que Doscientos podrá usar y adaptar en otros proyectos, sin revelar información confidencial del Cliente. Los componentes de terceros se regirán por sus propias licencias.

7. **Colaboración.** El Cliente facilitará en plazo los accesos, contenidos, decisiones y validaciones necesarios. Los plazos podrán ajustarse de forma proporcional ante retrasos o dependencias imputables al Cliente o a terceros.

8. **Confidencialidad y datos.** Cada parte protegerá la información confidencial de la otra. Si Doscientos trata datos personales por cuenta del Cliente, las partes formalizarán, cuando sea exigible, el correspondiente acuerdo de encargo de tratamiento antes de dicho acceso.

9. **Caso de éxito.** Salvo pacto escrito distinto, el Cliente autoriza a Doscientos a describir la colaboración como caso de éxito y a mostrar los entregables ya hechos públicos, su denominación, marcas y logotipos, exclusivamente para acreditar su experiencia profesional. Doscientos no divulgará información confidencial, datos personales ni métricas no públicas, y atenderá las objeciones razonables y justificadas del Cliente cuando exista un riesgo legítimo para su seguridad, sus secretos empresariales o el cumplimiento normativo.

10. **Responsabilidad y ley aplicable.** Salvo norma imperativa aplicable, la responsabilidad total de Doscientos se limitará al importe efectivamente abonado por el Cliente por el servicio que origine la reclamación. Para relaciones entre empresas, las partes se someten a los juzgados y tribunales de Barcelona; si el Cliente actúa como consumidor, se aplicarán los fueros imperativos que correspondan.$$;

comment on column public.proposals.legal_terms is
  'Complete, client-visible contractual annex owned and editable by each proposal.';

create or replace function public.update_proposal_items_versioned(
  p_proposal_id uuid,
  p_expected_version bigint,
  p_patch jsonb,
  p_items jsonb
)
returns table (version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_total numeric(12,2);
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then
    raise exception 'No autorizado para editar propuestas';
  end if;
  if jsonb_typeof(p_patch) <> 'object'
     or p_patch - array[
       'title', 'valid_until', 'notes', 'context_markdown', 'problems', 'solutions', 'terms',
       'legal_terms', 'scope_modules', 'deliverables', 'acceptance_criteria', 'payment_schedule',
       'payment_terms', 'change_management_terms', 'maintenance_options',
       'maintenance_selected_plan_id', 'maintenance_selection_source', 'maintenance_selected_at'
     ] <> '{}'::jsonb then
    raise exception 'Campos de propuesta no válidos';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La propuesta debe tener al menos una línea';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(length(btrim(item.value ->> 'description')), 0) = 0
      or length(item.value ->> 'description') > 500
      or jsonb_typeof(item.value -> 'quantity') <> 'number'
      or jsonb_typeof(item.value -> 'unit_price') <> 'number'
      or jsonb_typeof(item.value -> 'vat_rate') <> 'number'
      or (item.value ->> 'quantity')::numeric <= 0
      or (item.value ->> 'unit_price')::numeric < 0
      or (item.value ->> 'vat_rate')::numeric not between 0 and 100
      or coalesce(item.value ->> 'billing_cycle', 'none') not in ('none', 'monthly', 'quarterly', 'yearly')
  ) then
    raise exception 'Las líneas de propuesta no son válidas';
  end if;

  select * into v_proposal from public.proposals
    where id = p_proposal_id and deleted_at is null for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if v_proposal.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_proposal.status in ('accepted', 'rejected') then
    raise exception 'La propuesta ya ha sido respondida y no se puede editar';
  end if;

  select
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric
      * (item.value ->> 'vat_rate')::numeric / 100)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0)
    into v_subtotal, v_tax_amount from jsonb_array_elements(p_items) as item(value);
  v_total := round(v_subtotal + v_tax_amount, 2);

  update public.proposals set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    valid_until = case when p_patch ? 'valid_until' then nullif(p_patch ->> 'valid_until', '')::date else valid_until end,
    notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
    context_markdown = case when p_patch ? 'context_markdown' then p_patch ->> 'context_markdown' else context_markdown end,
    problems = case when p_patch ? 'problems' then p_patch -> 'problems' else problems end,
    solutions = case when p_patch ? 'solutions' then p_patch -> 'solutions' else solutions end,
    terms = case when p_patch ? 'terms' then p_patch ->> 'terms' else terms end,
    legal_terms = case when p_patch ? 'legal_terms' then coalesce(nullif(btrim(p_patch ->> 'legal_terms'), ''), legal_terms) else legal_terms end,
    scope_modules = case when p_patch ? 'scope_modules' then p_patch -> 'scope_modules' else scope_modules end,
    deliverables = case when p_patch ? 'deliverables' then p_patch ->> 'deliverables' else deliverables end,
    acceptance_criteria = case when p_patch ? 'acceptance_criteria' then p_patch ->> 'acceptance_criteria' else acceptance_criteria end,
    payment_schedule = case when p_patch ? 'payment_schedule' then p_patch ->> 'payment_schedule' else payment_schedule end,
    payment_terms = case when p_patch ? 'payment_terms' then p_patch ->> 'payment_terms' else payment_terms end,
    change_management_terms = case when p_patch ? 'change_management_terms' then p_patch ->> 'change_management_terms' else change_management_terms end,
    maintenance_options = case when p_patch ? 'maintenance_options' then p_patch -> 'maintenance_options' else maintenance_options end,
    maintenance_selected_plan_id = case when p_patch ? 'maintenance_selected_plan_id' then p_patch ->> 'maintenance_selected_plan_id' else maintenance_selected_plan_id end,
    maintenance_selection_source = case when p_patch ? 'maintenance_selection_source' then p_patch ->> 'maintenance_selection_source' else maintenance_selection_source end,
    maintenance_selected_at = case when p_patch ? 'maintenance_selected_at' then (p_patch ->> 'maintenance_selected_at')::timestamptz else maintenance_selected_at end,
    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total
  where id = p_proposal_id
  returning proposals.version into version;

  delete from public.proposal_items where proposal_id = p_proposal_id;
  insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle)
  select p_proposal_id, item.position - 1, item.value ->> 'description',
    (item.value ->> 'quantity')::numeric, (item.value ->> 'unit_price')::numeric,
    (item.value ->> 'vat_rate')::numeric, coalesce(item.value ->> 'billing_cycle', 'none')::public.expense_recurrence
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  return next;
end;
$$;

revoke all on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) to authenticated;