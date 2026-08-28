import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backofficeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = resolve(backofficeRoot, "../../modules/ui");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const link = spawnSync(pnpm, ["link", uiRoot], {
  cwd: backofficeRoot,
  stdio: "inherit",
});

if (link.status !== 0) process.exit(link.status ?? 1);

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
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill();
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
for (const child of processes) {
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
