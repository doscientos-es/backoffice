import { serverEnv } from "@/lib/env";

/** Server-side source of truth for the deployment environment. Fails closed if either flag is demo. */
export function isDemoMode(): boolean {
  const env = serverEnv();
  return env.DEMO_MODE === "true" || env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Public flag used by server-rendered UI props when available. */
export function isPublicDemoMode(): boolean {
  return isDemoMode();
}

export class DemoModeError extends Error {
  constructor(action: string) {
    super(`${action} está desactivado en modo demo`);
    this.name = "DemoModeError";
  }
}

/** Fails closed for integration code that cannot provide a useful mock. */
export function assertExternalActionAllowed(action: string): void {
  if (isDemoMode()) throw new DemoModeError(action);
}
