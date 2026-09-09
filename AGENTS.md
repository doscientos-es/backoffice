# Instrucciones del backoffice

La producción usa Supabase gestionado con datos reales. Nunca incluir ni reutilizar credenciales,
URLs o datos de producción en entornos de prueba.

## Migraciones de Supabase

Cuando el agente cree o modifique una migración en `supabase/migrations`,
debe aplicarla automáticamente al proyecto Supabase de backoffice mediante el
flujo de migraciones disponible y verificar que el cambio quedó activo.
El usuario autoriza de forma permanente estas aplicaciones, incluida producción.
No debe aplicar migraciones ajenas, no revisadas o cuyo proyecto destino sea ambiguo.