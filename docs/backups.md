# Copias de seguridad del backoffice

## Qué cubre

El job diario llama a `GET /api/cron/backoffice-backup` a las 02:30 UTC. El endpoint solo acepta
`Authorization: Bearer <CRON_SECRET>` y delega en el servidor de backups. La copia debe contener:

- un dump restaurable de PostgreSQL, incluidos los esquemas necesarios para la aplicación;
- los objetos de todos los buckets de Supabase Storage;
- un manifiesto con fecha, tamaño, versión y resultado de la réplica de Storage.

El destino en FileBrowser es `doscientos-backoffice`. El runner debe aplicar `retention.keepDaily`
y eliminar las copias más antiguas después de verificar que la nueva copia y su manifiesto son válidos.
El valor por defecto en la app es 14 días; se limita a 90 para evitar consumos accidentales.

## Variables de producción

Configurar en el proyecto Vercel **backoffice** y nunca en el cliente:

- `BACKUP_RUNNER_URL`: endpoint HTTPS privado del runner.
- `BACKUP_RUNNER_TOKEN`: token dedicado para app → runner.
- `BACKUP_DB_HOST`, `BACKUP_DB_PORT`, `BACKUP_DB_NAME`, `BACKUP_DB_USER`, `BACKUP_DB_PASSWORD`:
  conexión de solo backup a PostgreSQL.
- `BACKUP_RETENTION_DAYS`: días a conservar (por defecto `14`).
- `FILEBROWSER_API_URL`, `FILEBROWSER_USER`, `FILEBROWSER_PASSWORD`: muestran el historial en Ajustes.
- `CRON_SECRET` y, en GitHub Actions, los secretos `CRON_SECRET` y `APP_URL`.

No configurar estas variables en `backoffice-demo`: la ruta devuelve un no-op y la demo no debe
emitir copias externas.

## Contrato con el backup runner

Además de los parámetros planos ya usados para los backups de webs, el endpoint recibe:

```json
{
  "clientSlug": "doscientos-backoffice",
  "schedule": "daily",
  "retention": { "keepDaily": 14 },
  "supabase": { "url": "https://…", "serviceRoleKey": "…", "includeStorage": true }
}
```

El runner es un servicio de confianza: no debe registrar ni persistir credenciales fuera del proceso,
ni aceptar llamadas sin su token. Debe usar `serviceRoleKey` únicamente para listar y descargar
objetos de Storage, y desecharla al terminar. Si no puede copiar un bucket o validar el dump, debe
responder con error para que GitHub Actions marque el job como fallido.

## Restauración y comprobación

Restaurar primero PostgreSQL en un entorno aislado y luego los objetos de Storage conservando sus
rutas. Verificar el manifiesto, el recuento de tablas y buckets y una lectura autenticada antes de
considerar válida la restauración. Hacer una prueba de restauración trimestral.

Las descargas en **Ajustes → Copias** son complementarias: JSON contiene datos operativos sin
credenciales ni factores de acceso; CSV permite descargar una tabla para Excel. No sustituyen al dump
ni incluyen binarios de Storage.
