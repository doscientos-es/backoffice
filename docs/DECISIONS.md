# Decisiones de arquitectura y producto

Registro de decisiones técnicas y de producto.
Incluye explícitamente lo que **no se construirá** y por qué, para evitar que estas ideas vuelvan a plantearse sin una razón que cambie el contexto.

---

## ❌ Lo que NO se construye (y por qué)

### 1. Grid visual estilo Instagram / "Vista de Perfil"

**Decisión**: No.  
**Contexto**: Se evaluó añadir una cuadrícula de fotos estilo Instagram dentro del backoffice para visualizar el muro del perfil gestionado.  
**Razón**: Es vanity feature pura. El backoffice es una herramienta de trabajo (publicar, medir, responder), no un cliente de la red social. Agregar un grid no aporta valor operativo y añade complejidad de mantenimiento en los adapters (`fetchMediaFeed` en `Publisher`). Si se quiere ver el feed, abrir la app/web oficial de la red social.  
**Revisitar si**: El caso de uso cambia a curación de contenido o grid planning para clients que requieran aprobación previa de publicaciones.

---

### 2. Clon de Buffer/Hootsuite (calendario editorial completo)

**Decisión**: No.  
**Contexto**: El módulo Social Hub gestiona publicaciones, inbox de comentarios e insights. Se valoró expandirlo con calendario drag-and-drop, programación multi-cuenta avanzada, colaboración en borradores, etc.  
**Razón**: La paridad con herramientas SaaS especializadas (Buffer, Hootsuite, Metricool) requiere meses de desarrollo y no es el core business de este backoffice. El punto de parada correcto es: **publicar + inbox + insights**. Todo lo demás es coste de oportunidad frente a las funcionalidades de agencia core (proyectos, facturación, CRM).  
**Revisitar si**: doscientos pivota a ofrecer el backoffice como SaaS a otras agencias.

---

### 3. Módulo de BI / Reporting avanzado

**Decisión**: No.  
**Contexto**: Se valoró añadir dashboards de business intelligence con drill-down, exportaciones complejas, informes programados y filtros cruzados.  
**Razón**: Los widgets Recharts existentes (finanzas, marketing, inicio) cubren el 80% de las necesidades de una agencia pequeña. Competir en features con Metabase, Looker o Tableau es un pozo sin fondo de mantenimiento. Si se necesita análisis profundo ad-hoc, conectar Metabase/Grafana directamente a Supabase Postgres cuesta menos que construirlo.  
**Revisitar si**: Hay un caso de uso de cliente externo que requiera informes periódicos automatizados.

---

### 4. Chat / mensajería interna

**Decisión**: No.  
**Contexto**: Se valoró añadir un sistema de mensajería entre miembros del equipo dentro del backoffice.  
**Razón**: Slack, Teams o el propio Telegram (ya integrado para notificaciones) cubren este caso. Reinventar una herramienta de comunicación en un backoffice crea fragmentación: la gente no adopta el chat interno cuando ya tiene otra herramienta. El coste de implementación (WebSockets, presencia, historial, notificaciones push) no se justifica.  
**Revisitar si**: El equipo decide migrar completamente fuera de Slack/Teams y necesita comunicación integrada con entidades del CRM.

---

### 5. Vault (Bóveda) gestionada en casa a largo plazo

**Decisión**: Mantener **con reservas**; evaluar migración a herramienta externa en 2025.  
**Contexto**: El módulo Vault gestiona secretos cifrados del equipo (contraseñas, API keys, credenciales de clientes) con cifrado propio (scrypt, rotación de claves).  
**Razón de la reserva**: Mantener cifrado criptográfico propio implica coste de auditoría de seguridad, gestión de incidentes y responsabilidad legal. Herramientas como 1Password Teams o Bitwarden Business ofrecen la misma funcionalidad con auditorías independientes, SSO, y sin coste de desarrollo.  
**Acción recomendada**: No extender el Vault con nuevas features. Si el equipo crece o la responsabilidad de datos de clientes aumenta, migrar a 1Password/Bitwarden.  
**Revisitar si**: El Vault sigue siendo la única opción viable por restricciones presupuestarias o de integración.

---

### 6. Documentos (browser genérico de adjuntos) como destino principal

**Decisión**: Retirado del sidebar como destino de primer nivel.  
**Contexto**: `/documents` era una tabla de todos los `attachments` del sistema, accesible desde el sidebar bajo "Más".  
**Razón**: Los adjuntos tienen sentido en el contexto de la entidad a la que pertenecen (un proyecto, un cliente, una propuesta). Un browser global de adjuntos sin contexto tiene muy bajo uso y confundía con `/internal-docs`. Los archivos siguen siendo accesibles desde la entidad correspondiente.  
**Revisitar si**: Surge un caso de uso de gestión documental centralizada (DMS) que justifique una vista global con clasificación, tags y búsqueda semántica.

---

## ✅ Principios de diseño acordados

1. **Estrella polar de una agencia**: "¿Cuál es el estado y el margen de cada cliente y proyecto?" Cualquier feature que refuerce esa pregunta tiene alta prioridad. Cualquier superficie nueva y aislada, no.
2. **Build vs Buy**: Antes de construir cualquier módulo de infraestructura (auth, cifrado, chat, BI), evaluar primero si existe una herramienta SaaS que resuelva el 80% del caso con coste cero de mantenimiento.
3. **Navegación command-first**: El `CommandPalette` es el mecanismo de navegación principal para usuarios power. El sidebar es el fallback visual. No extender el sidebar indefinidamente; agrupar y simplificar.
4. **No saturar el backoffice de Social**: El Social Hub es para operaciones, no para replicar las apps nativas de las redes sociales.
