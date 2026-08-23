const required = [
  "VERIFACTU_PACKAGE_VERSION",
  "createVerifactuClient",
  "computeInvoiceHash",
  "computeCancellationHash",
  "buildVerifactuXml",
  "buildVerifactuCancellationXml",
  "prepareDurableVerifactuRecord",
  "validateSpanishFiscalIdentity",
  "getAeatErrorMetadata",
];

const pkg = await import("@doscientos/verifactu");
const missing = required.filter((name) => !(name in pkg));
if (missing.length > 0) {
  throw new Error(
    `@doscientos/verifactu incompatible o antiguo. Faltan: ${missing.join(", ")}. ` +
    "Instala la versión construida/publicada compatible con el backoffice.",
  );
}

if (pkg.VERIFACTU_PACKAGE_VERSION !== "0.1.20") {
  throw new Error(
    `@doscientos/verifactu ${String(pkg.VERIFACTU_PACKAGE_VERSION)} no es compatible; se requiere 0.1.20.`,
  );
}

console.log(`@doscientos/verifactu ${pkg.VERIFACTU_PACKAGE_VERSION}: contrato compatible`);
