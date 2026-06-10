/**
 * Domain constants for the Verifactu / SIF module (RD 1007/2023, HAC/1177/2024).
 */

/** AEAT "ValidarQR" cotejo endpoints, keyed by `VERIFACTU_ENV`. */
export const AEAT_VALIDATE_QR_URL = {
  prod: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  test: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
} as const;
