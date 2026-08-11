# ADR-001: límites cohesionados para el backoffice

**Estado:** aceptada · **Fecha:** 2026-08-11

## Contexto

El backoffice integra CRM, facturación fiscal, proyectos, propuestas y una bóveda. Los módulos
grandes eran fáciles de extender a corto plazo, pero mezclaban presentación, validación,
persistencia y servicios externos. Eso ocultaba invariantes de negocio y encarecía los cambios.

## Decisión

### 1. Server actions son adaptadores finos

Una action solo puede autenticar, validar con un schema, invocar **un caso de uso** y revalidar.
No debe contener reglas reutilizables, JSX, SQL ni lógica de integración repetida. Los casos de
uso viven en `lib/<dominio>/` y las actions conservan el contrato público mientras se extraen.

### 2. Las reglas de negocio son puras y se prueban en aislamiento

Estados permitidos, cadencias, normalizadores, cálculo de totales y elegibilidad deben ser
funciones puras. Cada regla nueva requiere una prueba de tabla o de invariantes. No duplicar
estas reglas en página, action, componente ni endpoint.

### 3. Una pantalla consume un read model tipado

Las páginas no construyen consultas Supabase ni hacen casts de joins. `lib/<dominio>/queries.ts`
devuelve un DTO de pantalla; el mapeo del resultado crudo se hace una vez en esa capa.

### 4. Componentes por intención de usuario

Un componente cliente representa una interacción cohesionada. El DnD, los filtros, los diálogos
de llamada/email/reunión y la tabla de una bóveda se separan en componentes o hooks. Compartir
primitivas y helpers, no un componente "universal" de cientos de líneas.

### 5. Operaciones multi-escritura preservan invariantes

Para cabecera + líneas, conversiones y cambios que escriben timeline, usar una frontera de caso
de uso. Si las escrituras deben ser atómicas, implementar una RPC/migración nueva y verificarla
en producción y demo; nunca encadenar `delete` + `insert` como sustituto de una transacción.

### 6. Integraciones externas son adaptadores best-effort

Meta, email, Drive y Calendar no deciden el estado interno. Se invocan desde un adaptador tras
persistir el estado y registran fallo sin deshacer una operación interna válida. Para efectos que
no pueden perderse, usar una outbox durable.

### 7. Facturación y bóveda son dominios restringidos

No cambiar reglas de VeriFactu, inmutabilidad fiscal, cifrado ni autorización al refactorizar.
Primero añadir pruebas de regresión; después extraer funciones puras y repositorios. El secreto
cifrado nunca llega a filtros, logs, props de diagnóstico ni tests.

## Consecuencias

- Un archivo nuevo debe pertenecer a un dominio y tener una única responsabilidad nombrable.
- Antes de introducir un cast `as unknown as`, crear o ampliar el DTO que falta.
- Antes de una migración, leer la skill `demo-database-management` y aplicar exactamente el
  mismo SQL a producción y demo siguiendo su verificación obligatoria.
- Las revisiones deben rechazar nuevas actions o páginas que reintroduzcan responsabilidades ya
  extraídas.