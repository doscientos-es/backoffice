import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restorePublishedUi } from "./restore-published-ui.mjs";

const backofficeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = resolve(backofficeRoot, "../../modules/ui");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runPnpm(args, cwd = backofficeRoot) {
  const result = spawnSync(pnpm, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(uiRoot)) {
  console.error(`No se encontró el paquete UI local en ${uiRoot}.`);
  process.exit(1);
}

const uiPackage = JSON.parse(readFileSync(resolve(uiRoot, "package.json"), "utf8"));
if (uiPackage.name !== "@doscientos/ui") {
  console.error(`El paquete local esperado es @doscientos/ui, no ${String(uiPackage.name)}.`);
  process.exit(1);
}

// Ensure dist exists before Next resolves the package, then keep it updated.
runPnpm(["--dir", uiRoot, "build"]);
runPnpm(["link", uiRoot]);
console.log("Usando @doscientos/ui local; se restaurará npm al cerrar el servidor.");

const environment = { ...process.env, DOSCIENTOS_UI_DEV_LINK: "true" };
const processes = [
  spawn(pnpm, ["--dir", uiRoot, "dev"], { env: environment, stdio: "inherit" }),
  spawn(pnpm, ["exec", "next", "dev", "--turbo"], {
    cwd: backofficeRoot,
    env: environment,
    stdio: "inherit",
  }),
];

let stopping = false;
let exitCode = 0;
let remainingProcesses = processes.length;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of processes) child.kill();
}

function finish() {
  if (!restorePublishedUi()) exitCode ||= 1;
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop(0));
for (const child of processes) {
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
    remainingProcesses -= 1;
    if (remainingProcesses === 0) finish();
  });
}
