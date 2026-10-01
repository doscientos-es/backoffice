# Novedades del backoffice

`CHANGELOG.md` es la fuente de verdad y guarda en un comentario el último SHA revisado. `lib/changelog.json` es una proyección versionada para Next. Se regenera automáticamente al ejecutar `pnpm build` (y por tanto en el pipeline de CI); `pnpm dev` no lo ejecuta. También puedes ejecutar `pnpm changelog:sync` a mano. La sección autenticada `/settings/changelog` importa el JSON; no necesita acceso al repositorio Git ni al filesystem en producción.

Desde **esta raíz Git**, pide en Augment «actualiza el changelog del backoffice». La skill versionada en `.agents/skills/product-changelog` contrasta el rango Git y los PRs accesibles; actualiza el Markdown y ejecuta `pnpm changelog:sync`. Si no hay acceso a PRs, debe indicarlo, no inferirlos. `pnpm changelog:check` verifica que el frontend muestra el contenido actual antes de desplegar. Usa `pnpm exec changelog plan` para consultar el intervalo sin modificar nada.

La entrada inicial cubre cambios recientes hasta el SHA del comentario, no todo el histórico. No confundas commits integrados con despliegues, no incluyas datos de clientes y revisa el diff antes de publicar. La skill no hace commit ni despliega automáticamente.
