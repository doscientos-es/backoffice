import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backofficeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = resolve(backofficeRoot, "../../modules/ui");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

if (!existsSync(uiRoot)) {
  console.error(`No se encontró el paquete UI local en ${uiRoot}.`);
  process.exit(1);
}

const uiPackage = JSON.parse(readFileSync(resolve(uiRoot, "package.json"), "utf8"));
if (uiPackage.name !== "@doscientos/ui") {
  console.error(`El paquete local esperado es @doscientos/ui, no ${String(uiPackage.name)}.`);
  process.exit(1);
}

if (!existsSync(resolve(uiRoot, "node_modules/react-aria-components"))) {
  console.error(`Faltan las dependencias de ${uiRoot}. Ejecuta pnpm install en ese directorio.`);
  process.exit(1);
}

console.log("Usando el código fuente local de @doscientos/ui sin modificar pnpm-lock.yaml.");

const environment = { ...process.env, DOSCIENTOS_UI_DEV_LINK: "true" };
const next = spawn(pnpm, ["exec", "next", "dev", "--turbo"], {
  cwd: backofficeRoot,
  env: environment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => next.kill());
next.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
