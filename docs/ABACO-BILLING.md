# Facturación de las cuotas de Ábaco

- **Backoffice**: seguimiento comercial, ficha fiscal, AEAT, serie de Doscientos, facturas, cobros conciliados y envíos. Al cambiar el estado a `Ganado`, selecciona `Ábaco` como producto vendido. En Leads, filtra por `Producto vendido → Ábaco`; en Facturas, usa `Origen → Suscripción Ábaco`. No crees suscripciones paralelas en Backoffice para estos clientes.
- **Superadmin de Ábaco**: empresas, planes, módulos, permisos comerciales, renovaciones, incidencias de cobro y estado del traspaso de factura. No asigna números, rectifica, ni vuelve a emitir facturas de Doscientos.
- **Empresa usuaria**: guarda los datos fiscales de la suscripción en `Ajustes → Plan y facturación`. Aquí descarga el justificante de Redsys y, cuando está disponible, la factura fiscal de Backoffice. Estos datos no cambian el emisor de las facturas que la empresa gestiona para sus propios clientes.

Marcar un lead como ganado clasifica la venta: no crea la suscripción, no cobra y no cambia el origen de sus facturas. Si el lead ya está ganado, asigna o corrige el producto desde su ficha. Una empresa puede comprar Ábaco y otros servicios usando la misma ficha fiscal. Si ya existe su cliente en Backoffice, se busca por NIF; no se sobrescriben fichas existentes ni se elige entre varios resultados. Ante discrepancias, corrige la ficha de Backoffice o el perfil de Ábaco según corresponda antes de intentar de nuevo. El alcance inicial es España, EUR e IVA del 21 %.

## Activación por entorno

1. Aplica las migraciones en cada proyecto y publica Backoffice y el frontend de Ábaco. Confirma que el cron existente de VERI*FACTU de Backoffice funciona, que están configurados su certificado, serie, emisor fiscal y Resend, y que el portal sirve PDFs y no ofrece pagar una factura pagada.
2. Configura en Backoffice `ABACO_BILLING_PORTAL_URL` con la URL HTTPS del portal de ese entorno y `ABACO_BILLING_SECRET` con un secreto dedicado de al menos 32 caracteres. En las Edge Functions de Ábaco configura el mismo `ABACO_BILLING_SECRET` y `ABACO_BACKOFFICE_BILLING_URL` apuntando a `/api/integrations/abaco/billing` del Backoffice del mismo entorno. No reutilices URLs, datos ni credenciales de producción en pruebas.
3. Publica `billing`, `billing-renew` y `subscription-invoices`; los dos jobs usan `CRON_SECRET`. En Vault de Ábaco, `cron_secret` debe coincidir con `CRON_SECRET` y `abaco_project_url` debe contener la URL HTTPS del **mismo proyecto de Ábaco**. El job `subscription-invoice-handoffs` solo llama a la función si ambas entradas existen. No configures este último valor ni habilites Redsys de producción antes de validar ambos despliegues. Las nuevas funciones no abren cobros con Redsys de pruebas ni con otra divisa.
4. En un entorno aislado, usa cobros confirmados sintéticos y dobles de AEAT y Resend. Comprueba un alta y una renovación, entrega duplicada, cobro fallido, error de Backoffice, error de correo, perfil cambiado tras reservar y aislamiento entre empresas. Comprueba que al repetir el evento se obtienen el mismo número y un solo cobro; un error de correo no crea otra factura. No envíes esos casos a AEAT ni al Resend real.

## Incidencias

- `Pendiente de respuesta de AEAT`: comprueba el cron fiscal. Si hay rechazo, regulariza el registro desde la factura existente; no emitas otra cuota ni vuelvas a cobrarla.
- `Correo pendiente`: se reintenta con la misma clave en Resend. El proveedor acepta el correo, pero eso no garantiza que haya llegado a la bandeja de entrada.
- `Comprobar entrega antes de reenviar`: después de 23 horas no se intenta otro envío automático. Revisa el historial de Resend antes de usar el reenvío manual de la factura existente.
- `Sin solicitud de factura`: es un cobro sin traspaso, por ejemplo previo al flujo. Revisa la referencia y la fecha antes de cualquier actuación manual; no se reemite el histórico en bloque.
