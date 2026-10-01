# Novedades del backoffice

`CHANGELOG.md` y `lib/changelog.json` se generan desde Git con Conventional Commits (`feat` -> Nuevas funciones, `fix` -> Correcciones, `perf` -> Mejoras). No se editan a mano.

- `pnpm build` los regenera con `--soft`: en clones superficiales conserva los archivos versionados.
- `pnpm changelog:sync` los regenera a mano.
- `pnpm changelog:check` falla si no coinciden con el historial Git (necesita `fetch-depth: 0`).
- Una release la cierra un commit `chore(release): vX.Y.Z`; lo posterior aparece como Sin publicar.

La seccion autenticada `/settings/changelog` importa el JSON; no necesita acceso a Git en produccion.
