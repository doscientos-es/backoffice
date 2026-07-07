-- ============================================================
-- Seed: plantillas de email para el ciclo de vida de leads
-- ============================================================
-- Variables disponibles: {{nombre}}, {{empresa}}, {{email}}, {{sender_name}}
-- body_html contiene Markdown (se convierte a HTML al enviar/previsualizar).
-- ON CONFLICT DO NOTHING → idempotente, no sobreescribe ediciones manuales.

insert into public.email_templates
  (slug, name, subject, body_html, variables, include_signature, active)
values

-- 1. PRIMER CONTACTO ─────────────────────────────────────────────────────────
(
  'primer_contacto',
  'Primer contacto',
  'Hola, {{nombre}} — hablemos sobre tu proyecto',
  $md$Hola **{{nombre}}**,

Gracias por ponerte en contacto con nosotros. He leído tu mensaje y me parece un proyecto muy interesante.

Me gustaría entender mejor lo que necesitas para poder ayudarte de la mejor forma posible. ¿Tienes unos minutos esta semana para una llamada rápida de 20–30 minutos?

Puedes decirme qué horario te va mejor y lo agendamos sin compromiso.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 2. SEGUIMIENTO (sin respuesta) ─────────────────────────────────────────────
(
  'seguimiento',
  'Seguimiento',
  '{{nombre}}, ¿sigues interesado en tu proyecto?',
  $md$Hola **{{nombre}}**,

Te escribo para hacer un seguimiento de mi mensaje anterior. Entiendo que el día a día es muy ocupado, así que quería asegurarme de que no se perdió en el buzón.

Si sigues interesado en hablar sobre tu proyecto, estaré encantado de encontrar un hueco esta semana.

Y si la situación ha cambiado, no hay ningún problema — cuéntamelo y vemos qué tiene sentido.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 3. SOLICITAR REUNIÓN ───────────────────────────────────────────────────────
(
  'solicitar_reunion',
  'Solicitar reunión',
  '¿Tienes 30 min esta semana, {{nombre}}?',
  $md$Hola **{{nombre}}**,

Me gustaría reservar un momento para hablar contigo y entender bien el contexto de tu proyecto antes de seguir adelante.

La idea sería una llamada de unos 30 minutos para:
- Entender qué quieres conseguir
- Ver si encajamos bien
- Contarte cómo trabajamos

¿Qué días te vienen mejor? Puedo adaptarme a tu horario.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 4. CONFIRMACIÓN DE REUNIÓN ─────────────────────────────────────────────────
(
  'confirmacion_reunion',
  'Confirmación de reunión',
  'Confirmado: nuestra llamada — {{nombre}}',
  $md$Hola **{{nombre}}**,

Perfecto, queda confirmada nuestra llamada. Te espero en el horario acordado.

Si necesitas cambiar algo o tienes cualquier duda antes de la reunión, responde a este email y lo gestionamos.

¡Hasta pronto!

{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 5. RESUMEN POST-REUNIÓN ────────────────────────────────────────────────────
(
  'post_reunion',
  'Resumen post-reunión',
  'Resumen de nuestra conversación, {{nombre}}',
  $md$Hola **{{nombre}}**,

Ha sido un placer hablar contigo. Te resumo los puntos clave de nuestra conversación:

- **Objetivo:** [completar]
- **Alcance aproximado:** [completar]
- **Siguiente paso:** [completar]

Voy a preparar una propuesta adaptada a lo que comentamos. Te la enviaré en los próximos días para que puedas revisarla con calma.

Si recuerdas algo más que quieras incluir o tienes alguna duda, escríbeme sin problema.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 6. PROPUESTA EN PREPARACIÓN ────────────────────────────────────────────────
(
  'propuesta_en_camino',
  'Propuesta en preparación',
  'Tu propuesta está en preparación, {{nombre}}',
  $md$Hola **{{nombre}}**,

Quería avisarte de que ya estoy trabajando en tu propuesta. Basándome en todo lo que hablamos, estoy preparando algo a medida para tu caso.

Te la enviaré en breve para que puedas revisarla tranquilamente, hacer preguntas y comentar lo que necesites.

Si mientras tanto se te ocurre algo que quieras añadir o cambiar, dímelo y lo tengo en cuenta.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 7. SEGUIMIENTO DE PROPUESTA ────────────────────────────────────────────────
(
  'seguimiento_propuesta',
  'Seguimiento de propuesta',
  '{{nombre}}, ¿tienes alguna duda sobre la propuesta?',
  $md$Hola **{{nombre}}**,

Te escribo para asegurarme de que recibiste la propuesta que te envié y que todo quedó claro.

Si tienes cualquier duda — sobre el alcance, los plazos, el precio o cualquier otra cosa — estoy aquí para resolverla. También podemos ajustar algo si lo necesitas.

¿Cómo lo ves?

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 8. AJUSTE / NEGOCIACIÓN ────────────────────────────────────────────────────
(
  'ajuste_propuesta',
  'Ajuste de propuesta',
  'Ajustes en tu propuesta, {{nombre}}',
  $md$Hola **{{nombre}}**,

Gracias por tu feedback. He revisado la propuesta teniendo en cuenta lo que me comentaste y he preparado una versión ajustada.

Los cambios principales son:
- [cambio 1]
- [cambio 2]

Te envío la versión actualizada para que la revises. Si hay algo más que quieras afinar, cuéntamelo y lo vemos juntos.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 9. BIENVENIDA COMO CLIENTE ─────────────────────────────────────────────────
(
  'bienvenida_cliente',
  'Bienvenida como cliente',
  '¡Bienvenido/a a bordo, {{nombre}}! 🎉',
  $md$Hola **{{nombre}}**,

¡Estamos muy contentos de empezar a trabajar juntos! Esto va a ser un gran proyecto.

En los próximos días me pondré en contacto contigo para:
1. Confirmar los detalles de inicio
2. Darte acceso a las herramientas que usaremos
3. Agendar la reunión de arranque

Si tienes cualquier pregunta antes de empezar, escríbeme aquí mismo.

¡Adelante!

{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 10. CIERRE AMISTOSO (perdido / no interesa) ────────────────────────────────
(
  'cierre_amistoso',
  'Cierre amistoso',
  'Gracias por tu tiempo, {{nombre}}',
  $md$Hola **{{nombre}}**,

Quería escribirte para cerrar el círculo y agradecerte el tiempo que nos dedicaste.

Entiendo que por ahora no es el momento adecuado, y no hay ningún problema. Si en el futuro la situación cambia o surge un nuevo proyecto, estaremos encantados de retomarlo.

Mucha suerte con todo.

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
),

-- 11. REACTIVACIÓN (lead dormido) ────────────────────────────────────────────
(
  'reactivacion',
  'Reactivar lead',
  '{{nombre}}, ¿sigue en pie tu proyecto?',
  $md$Hola **{{nombre}}**,

Han pasado unos meses desde que hablamos y quería ver cómo estás y si tu proyecto sigue adelante.

El mercado cambia, los planes evolucionan, y a veces el momento correcto llega más tarde. Si ahora es buen momento para retomar la conversación, estaré encantado de hacerlo.

¿Cómo está la situación?

Un saludo,
{{sender_name}}$md$,
  ARRAY['nombre','sender_name'],
  true, true
)

on conflict (slug) do nothing;
