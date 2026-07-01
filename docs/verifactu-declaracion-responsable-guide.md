# Guía: Declaración Responsable Verifactu para proyectos de clientes

## Contexto legal

Según el **Art. 13 del RD 1007/2023** y la **Orden HAC/1177/2024**, el productor de
un Sistema Informático de Facturación (SIF) debe incluir una Declaración Responsable
**dentro del propio software**, accesible en cada versión. No se registra ni se envía
a la AEAT — es autocertificación bajo responsabilidad del productor.

**Quién firma la DR:** Doscientos Estudio S.L. como productor del SIF.
**Por producto:** una DR por cada SIF distinto que se comercialice (backoffice, CRM cliente, etc.).

---

## Cuándo generar una DR nueva

- Al crear un nuevo proyecto para un cliente que incluya emisión de facturas (Verifactu).
- Al actualizar la versión del software con cambios relevantes en el módulo de facturación.
- Si cambia el `IdSistemaInformatico` (2 chars, único por producto).

---

## Datos necesarios antes de redactar

Recopilar del proyecto concreto:

| Campo | Ejemplo | Dónde se configura |
|---|---|---|
| Nombre del SIF | "CRM Empresa ABC" | `VERIFACTU_SOFTWARE_NAME` en `.env` |
| IdSistemaInformatico | "C1" | `VERIFACTU_SOFTWARE_ID` (2 chars, distinto por producto) |
| Versión inicial | "1.0.0" | `VERIFACTU_SOFTWARE_VERSION` |
| URL pública del SIF | `https://crm.empresaabc.es` | URL de producción del cliente |
| Email de contacto Doscientos | hola@doscientos.es | Siempre el mismo |
| Fecha de la declaración | Fecha de puesta en producción | — |

---

## Template de Declaración Responsable

Sustituir los valores entre `{{ }}`:

```
DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN
Conforme al Art. 13 del Real Decreto 1007/2023 y la Orden HAC/1177/2024

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. IDENTIFICACIÓN DEL PRODUCTOR

   Denominación social : Doscientos Estudio S.L.
   Sitio web           : https://doscientos.es
   Contacto            : hola@doscientos.es

2. IDENTIFICACIÓN DEL SISTEMA INFORMÁTICO DE FACTURACIÓN (SIF)

   Nombre del sistema         : {{ VERIFACTU_SOFTWARE_NAME }}
   IdSistemaInformatico       : {{ VERIFACTU_SOFTWARE_ID }}
   Versión                    : {{ VERIFACTU_SOFTWARE_VERSION }}
   URL donde está accesible   : {{ URL_PUBLICA }}
   Modalidad                  : VERI*FACTU (emisión de facturas verificables)

3. DECLARACIÓN DE CUMPLIMIENTO

   El productor declara, bajo su responsabilidad, que el SIF identificado en
   el apartado 2 cumple las especificaciones técnicas y funcionales de:

   - Real Decreto 1007/2023, de 5 de diciembre (RRSIF)
   - Orden HAC/1177/2024, de 17 de octubre

   El sistema garantiza la integridad, inalterabilidad, conservación,
   accesibilidad, legibilidad y trazabilidad de los registros de facturación
   mediante encadenamiento criptográfico (hash SHA-256) y envío en tiempo real
   a la AEAT en modalidad VERI*FACTU.

4. CARACTERÍSTICAS TÉCNICAS

   - Modalidad única: VERI*FACTU (TipoUsoPosibleSoloVerifactu = S)
   - No multi-OT: un único obligado tributario por instalación
   - Protocolo de envío: SOAP 1.1 con mTLS (certificado P12 del obligado)
   - Hash: SHA-256 con encadenamiento de registros anteriores
   - QR: generado según especificaciones AEAT (Anexo II HAC/1177/2024)

5. ACCESO AL HISTÓRICO DE VERSIONES

   https://doscientos.es/legal/verifactu  (o la URL del propio SIF si aplica)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fecha: {{ FECHA_DD_MM_AAAA }}
Firmado por: Doscientos Estudio S.L.
```

---

## Checklist de onboarding Verifactu para cliente

Al incorporar Verifactu a un proyecto de cliente, seguir este orden:

- [ ] **Elegir `IdSistemaInformatico`** — 2 chars alfanuméricos, únicos entre todos los productos Doscientos. Registrar en tabla interna para no repetir.
- [ ] **Obtener certificado P12** del cliente (FNMT o Camerfirma). Confirmar que incluye capacidad de firma electrónica.
- [ ] **Configurar env vars** en el proyecto: `VERIFACTU_SOFTWARE_*`, `VERIFACTU_CERT_P12_BASE64`, `VERIFACTU_CERT_PASSWORD`, `VERIFACTU_ENV=test`.
- [ ] **Probar en entorno test** de la AEAT antes de pasar a `prod`.
- [ ] **Crear página `/legal` en el SIF** con la DR (puede ser esta misma ruta adaptada).
- [ ] **Redactar la DR** usando el template de arriba y añadirla a la ruta `/legal`.
- [ ] **Archivar copia** de la DR en `internal-docs` del backoffice (categoría "legal").

---

## Registro de productos SIF activos

| Producto | IdSistemaInformatico | Versión DR | Fecha |
|---|---|---|---|
| Doscientos Backoffice | D1 | 1.0.0 | 2025-07-01 |
| _(próximo proyecto)_ | — | — | — |

> Actualizar esta tabla cada vez que se ponga en producción un nuevo SIF.
