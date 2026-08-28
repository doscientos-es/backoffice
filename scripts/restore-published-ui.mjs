import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backofficeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(backofficeRoot, "node_modules/@doscientos/ui");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function isLocalUiLink() {
  try {
    return lstatSync(packagePath).isSymbolicLink();
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

/** Restore the version pinned in package.json and pnpm-lock.yaml when a local link remains. */
export function restorePublishedUi() {
  if (!isLocalUiLink()) return true;

  console.log("Restaurando @doscientos/ui desde el registro de npm…");
  const result = spawnSync(pnpm, ["unlink", "@doscientos/ui"], {
    cwd: backofficeRoot,
    stdio: "inherit",
  });
  if (result.status !== 0 || isLocalUiLink()) {
    console.error("No se pudo restaurar la dependencia publicada @doscientos/ui.");
    return false;
  }

  console.log("@doscientos/ui publicada restaurada.");
  return true;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = restorePublishedUi() ? 0 : 1;