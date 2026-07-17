---
name: demo-database-management
description: Gestiona migraciones y datos entre la Supabase de produccion y la demo self-hosted del backoffice Doscientos.
---

# Gestion de bases de datos

## Alcance

Esta skill aplica al backoffice de Doscientos cuando se cambia el esquema, se cargan datos fake o se actualiza la instancia demo.

La regla principal es: una migracion, dos destinos independientes.

## Entornos

### Produccion

- Vercel: proyecto `backoffice`.
- Supabase: instancia gestionada de produccion.
- Datos reales.
- Las migraciones de produccion se aplican con el MCP de Augment.

### Demo

- Vercel: proyecto `backoffice-demo`.
- URL: `https://backoffice-demo-ruddy.vercel.app`.
- Supabase self-hosted: `https://demo-supabase.185.250.36.170.sslip.io`.
- Servidor: `185.250.36.170`.
- Proyecto Docker: `/srv/doscientos-demo-supabase`.
- Contenedor PostgreSQL: `supabase-db`.
- Datos fake y usuarios demo.

Nunca mezclar credenciales, URLs, datos o tokens entre los dos entornos. No guardar secretos en el repositorio.

## Flujo obligatorio para una migracion

1. Crear una migracion nueva en `supabase/migrations/` con timestamp y nombre descriptivo.
2. Revisar que sea segura para ejecutarse sobre una base ya existente.
3. Aplicarla primero en produccion usando el MCP de Augment.
4. Verificar el resultado en produccion con una consulta o test acotado.
5. Aplicar exactamente el mismo SQL en la demo self-hosted.
6. Verificar la demo con el usuario demo y con datos fake.
7. Ejecutar los tests, TypeScript y Biome afectados.

No editar una migracion ya aplicada. Si hay un error, crear una nueva migracion correctiva.

## Aplicacion manual en la demo

La demo se aplico inicialmente ejecutando las migraciones en orden con `psql`. No asumir que `supabase db push` conoce el historial de la demo: comprobar primero la tabla de historial.

Comando base dentro del servidor:

```bash
cd /srv/doscientos-demo-supabase
sudo docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < /tmp/20260718090000_nombre.sql
```

Para transferir una migracion al servidor se puede usar SFTP/SCP o el mecanismo seguro disponible en el entorno del agente. Nunca poner la password en el comando, en un script versionado ni en los logs.

Antes de aplicarla, comprobar:

```bash
sudo docker exec supabase-db psql -U postgres -d postgres -c "select current_database(), current_user;"
```

Despues de aplicarla:

```bash
sudo docker exec supabase-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "select now();"
```

## Historial de migraciones de la demo

Antes de automatizar nuevas migraciones, comprobar si existe `supabase_migrations.schema_migrations` en la demo. Si no existe, no ejecutar todas las migraciones otra vez.

Crear un ledger interno una sola vez, marcar como baseline las migraciones que ya se aplicaron y registrar a partir de entonces cada filename aplicado. La automatizacion debe:

- aplicar solo migraciones nuevas;
- respetar el orden lexicografico por filename;
- usar `ON_ERROR_STOP=1`;
- detenerse ante el primer error;
- no marcar una migracion como aplicada si falla;
- crear un backup de PostgreSQL antes de cambios destructivos;
- no ejecutar seeds de produccion en la demo.

Si no se puede confirmar el baseline o el historial, parar y pedir revision antes de aplicar SQL.

## Datos fake

Los seeds fake deben vivir separados de las migraciones de esquema. Los datos de demo tienen que usar dominios como `example.test` y no copiar nombres, emails, telefonos, notas ni textos de clientes reales.

Al cargar datos fake:

- usar UUIDs deterministas cuando facilite repetir el seed;
- hacer el seed idempotente;
- mantener RLS activa;
- crear al menos un owner demo y usuarios de presentacion;
- asignar leads y tareas a usuarios demo para que la UI tenga actividad;
- revisar especialmente leads `archived`, que no deben contener datos reales;
- no importar tablas de produccion completas sin anonimizar.

## Diferencias de comportamiento demo/prod

La demo usa el mismo codigo, pero variables y Supabase diferentes. `DEMO_MODE=true` y `NEXT_PUBLIC_DEMO_MODE=true` solo deben existir en `backoffice-demo`.

En demo:

- Verifactu es `mock`.
- Redsys, pagos, Meta, LinkedIn, GitHub, Google, Telegram, backups y webhooks externos estan bloqueados o mockeados.
- Auth y operaciones internas sobre la base demo si funcionan.
- Nunca usar credenciales reales de empresa.

En produccion no activar `DEMO_MODE` ni reutilizar variables de demo.

## Verificacion minima

Desde `internal/backoffice`:

```powershell
$env:CI='1'; pnpm exec tsc --noEmit
pnpm exec vitest run app --testNamePattern inviteTeamMember
node .\node_modules\@biomejs\biome\bin\biome check --% <archivos-modificados>
```

Despues de una migracion verificar:

- login demo;
- lectura de las tablas afectadas con RLS;
- una pantalla de produccion solo si el cambio se aplico alli;
- que el backoffice normal sigue usando el proyecto Vercel `backoffice`;
- que la demo no hace llamadas externas inesperadas.

## Prompt operativo recomendado

Para una tarea de esquema, usar este formato:

```text
Crea la migracion <nombre> en supabase/migrations.
Aplicala primero en produccion mediante el MCP de Augment.
Despues aplicala en la Supabase demo self-hosted siguiendo la skill
demo-database-management, sin mezclar credenciales ni datos.
Verifica ambas bases y ejecuta los tests afectados.
No edites migraciones ya aplicadas y no ejecutes seeds reales en la demo.
``` 
