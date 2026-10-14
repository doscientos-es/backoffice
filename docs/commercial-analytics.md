# Rendimiento comercial y base para gamificación

## Dónde verlo

- **Leads → Análisis** (`/leads/analytics`): tiempos, resultados, seguimiento,
  marcador por persona y exportación de métricas agregadas en JSON.
- **Propuestas → Seguimiento**: pendientes, esperando más de 72 horas,
  vistas sin respuesta y sin apertura registrada. En estos filtros las propuestas
  más antiguas aparecen primero, salvo que se elija otra ordenación.
- **Ficha del lead → Siguiente movimiento**: acción concreta para confirmar
  recepción, resolver dudas o revisar la vigencia. Respeta los seguimientos futuros.

## Periodo y cohortes

El selector identifica leads y propuestas **creados** en el periodo. Sus resultados
y sus tiempos reflejan la evolución hasta ahora, aunque el envío o la aceptación
ocurriesen después del periodo. No es una fotografía del estado al final del periodo.

La actividad cuenta registros de llamadas, emails y reuniones **creados** en el periodo
y vinculados a leads visibles no eliminados. No garantiza que la llamada o reunión
ocurriese ese día: los registros pueden introducirse o importarse posteriormente.

La cobertura de seguimiento se calcula sobre leads activos de esa cohorte con
al menos un recordatorio pendiente fechado ahora o en el futuro. No cuenta tareas
ordinarias, reuniones sin recordatorio ni recordatorios vencidos como cobertura.

## Tiempos disponibles

| Tramo | Inicio | Final |
| --- | --- | --- |
| Primer contacto | Creación del lead | Primer contacto registrado |
| Entrega de propuesta | Creación del lead | Primer envío de cualquier propuesta vinculada |
| Preparación | Creación del borrador | Envío de la propuesta |
| Apertura | Envío | Primera apertura registrada del cliente |
| Aceptación | Envío | Aceptación registrada |
| Rechazo | Envío | Rechazo registrado |
| Ciclo de venta | Creación del lead ganado | Primer cambio registrado a Ganado |
| Entrega del proyecto | Aceptación | Firma del albarán |
| Espera de respuesta | Envío pendiente | Ahora |
| Edad del borrador | Creación del borrador pendiente | Ahora |

Cada tramo muestra media, mediana, P90 por rango más próximo, número de muestras
válidas y exclusiones. Los valores se calculan en horas naturales, no laborables.
Las fechas ausentes, inválidas, futuras o invertidas nunca se sustituyen por cero.
Los tiempos de aceptación y entrega no incluyen operaciones aún sin finalizar;
consultar también el tamaño de muestra y la espera de las pendientes.

El primer contacto depende de la fecha registrada por el CRM. La entrega de propuesta
se mide desde la entrada del lead, no desde una petición de presupuesto: actualmente
no hay una fecha específica de petición usada por este informe.

## Tasas e importes

- **Apertura:** enviadas con fecha de apertura / enviadas con envío registrado.
- **Aceptación sobre enviadas:** aceptadas enviadas / todas las enviadas.
- **Aceptación sobre decididas:** aceptadas enviadas / aceptadas o rechazadas enviadas.
- Las aceptaciones manuales sin envío se cuentan como aceptadas, pero se excluyen
  de las tasas de envío y del tiempo envío → aceptación.
- Los importes son los totales de propuestas **con IVA**, no ingresos cobrados.
  Los precios ausentes no se convierten en cero. El ticket medio utiliza solamente
  las aceptadas con precio disponible.

## Marcador y permisos

Leads: responsable actual. Propuestas: autor del borrador. Actividad: persona
registrada en `performed_by`. Estos criterios no reconstruyen quién fue dueño
de una oportunidad ni quién hizo el cierre en el pasado.

El marcador ordena por propuestas aceptadas y leads ganados. No otorga puntos por
volumen de llamadas ni introduce recompensas automáticas. Antes de definir premios,
comparar cohortes, carga de trabajo, muestras, reasignaciones y cobros efectivos.

Las consultas usan la sesión del usuario y RLS; no usan un cliente administrador.
Los importes se consultan en `proposal_prices` solo con permiso `proposals.prices`.
La exportación contiene únicamente las métricas agregadas visibles, sus definiciones
y el periodo, sin mensajes, teléfonos, tokens ni documentos de clientes.

El informe pagina todas las consultas. Si una lectura falla, se presenta un error
en lugar de estadísticas parciales. No requiere migraciones ni datos sintéticos
en producción.