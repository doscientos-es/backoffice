-- ============================================================
-- Seed: leads archivados importados del CRM anterior
-- ============================================================
-- Fuente: private/opportunities.csv (exportado de HighLevel/GHL)
-- Todos entran con status='archived' y external_source='legacy_crm'.
-- external_id = Opportunity ID original → permite re-ejecutar sin duplicados.

insert into public.leads (name, email, phone, source, notes, status, external_source, external_id, created_at, updated_at)
values

-- 1 (Ignacio Araluce González eliminado — ya existía como lead activo)

-- 2
('Simón Castillo',null,'+34679609978','Facebook',null,
 'archived','legacy_crm','YBF4y8a4mqSqE5iOgB9H',
 '2026-05-21T08:44:17.151Z','2026-05-25T15:51:34.646Z'),

-- 3
('BRIDGE__48','h@bridge48.com','+34662371548','Facebook',null,
 'archived','legacy_crm','WbcEfe3qeDj021dQVvGi',
 '2026-05-18T17:46:27.878Z','2026-05-25T15:51:11.378Z'),

-- 4
('Carlos','carlosgoyanes@hotmail.com','+34678582322','Facebook',
 $note$App para taxi, avisos con IA, sistema que al taxi más cercano le llegue un aviso. 9 personas. Llaman por teléfono a ellos. No puede facturar, 5-8k.$note$,
 'archived','legacy_crm','EY9wzDHroaIw8LhKXESI',
 '2026-05-13T21:03:35.105Z','2026-05-25T15:51:30.082Z'),

-- 5
('Alberto Rodriguez Piñon','arodriguez@caprackectclub.com','+34608579343','Facebook','no contesta',
 'archived','legacy_crm','IvmHlkAsTmPVmRKm6ijb',
 '2026-05-11T14:58:04.083Z','2026-05-14T06:10:29.606Z'),

-- 6
('Adrián Blanco','adrian@blun.es','+34637349834','Facebook',
 $note$Tiene el desarrollo a medias

quiere juntar sesame, holded y transporte gps en 1 app

10:30 mañana reu agendada$note$,
 'archived','legacy_crm','4H6CqjSGJmVNkcpSiFEx',
 '2026-05-04T13:59:42.449Z','2026-05-11T08:43:18.154Z'),

-- 7
('Marco Pancea','onceamarco7@gmail.com','+34608423318','Facebook',null,
 'archived','legacy_crm','6E1uaDITVCGjGJB4maoK',
 '2026-05-03T20:18:31.954Z','2026-05-12T10:28:00.279Z'),

-- 8
('Quim Bosch','bosch@consultoriabosch.com','+34639890990','Facebook',
 $note$llamada dia 19
cristina mena no me ha enviado el email$note$,
 'archived','legacy_crm','tKSqDQIvbuGPqsXngpKP',
 '2026-05-02T10:12:29.473Z','2026-05-25T15:51:44.669Z'),

-- 9
('Sebas Lendinez','s.lendinez@hotmail.com','+34601575959','Facebook',null,
 'archived','legacy_crm','00ly4ZhJJMxR5wDTpmxf',
 '2026-04-26T12:55:58.795Z','2026-05-05T10:09:30.842Z'),

-- 10
('Freddy Alberto Sanchez Pernia','fasp63@yahoo.es','+34695439029','Facebook',
 $note$Automatizar almacén, compra y flota de vehículos (camiones, furgonetas...) de una empresa de obras (agrícolas, forestales); tienen un almacén y necesitan controlar entradas, solicitudes, entradas. Sistema que codifica lo que tienen en almacén, inventario. Todo online. Jefe de obra solicita al almacén con firma y se la llevan; todo queda apuntado (entradas, salidas, precios, punto de pedido...).

Registro de proveedores, quién es fabricante... Para ver los distintos créditos, servicios...

Metadatos de los proyectos (presupuestos, cuándo empiezan, si se pasan del presupuesto...)

Tienen vehículos propios y otros alquilados. Quieren saber accidentes...

SAP compró "Lexa Natural" (donde él trabaja); trabajan con ayuntamientos, alcaldías.

Son 50 personas. ¿Con qué trabajan? Excel. 2 en almacén, 10 personas acceden al sistema.

Tendría la parte de flota (mantenimientos, programados, ¿está averiado?...) y de almacén.$note$,
 'archived','legacy_crm','FZo9016HUufrbHeyKWXx',
 '2026-04-21T15:16:47.282Z','2026-04-22T15:57:51.293Z'),

-- 11
('Vicent Cortina','vicentcortina77@gmail.com','+34626859540','Facebook','no contesta',
 'archived','legacy_crm','93IdD8e3W4fpQK6AYr0W',
 '2026-04-20T12:27:40.491Z','2026-04-22T14:32:19.394Z'),

-- 12
('Santigrale','santiago@farmaintegrale.com','+34620581494','Facebook',
 $note$Permite trazabilidad -> a quien le compro, cuando le compro, numero de lote, a quien vendo, papeleo para administración. Perfumería y parafarmacia. Saber stock.

Buenos días, Santiago. No he encontrado el briefing, si me lo pudieras enviar lo reviso hoy y te hago una propuesta. No contesta.$note$,
 'archived','legacy_crm','wY8CDqvZSOCWnBIl68Dr',
 '2026-04-19T15:03:36.826Z','2026-05-14T06:34:25.467Z'),

-- 13
('Ali Arif','aliarifepv@gmail.com','+34642120360','Facebook',null,
 'archived','legacy_crm','ftdhKhT9mvbNk6Y0zUqy',
 '2026-04-17T21:57:47.052Z','2026-04-20T08:17:44.282Z'),

-- 14
('Miguel Angel Hernandez','mahfernandezb@gmail.com','+34659761134','Facebook',
 $note$Valorando desarrollar software a medida (tipo CRM/ERP). Le enviamos propuesta de valor. No le llegaba el email inicialmente, email alternativo: miguel.hernandez@cadac.es$note$,
 'archived','legacy_crm','iLexzEn7uo0zXzdfPCtZ',
 '2026-04-16T00:04:47.879Z','2026-04-22T15:58:14.084Z'),

-- 15
('Joan Josep','gerenciaturisticsbarcelona@gmail.com',null,'Calendly',
 $note$Software de gestión de facturas con Verifactu. Estamos a la espera de su .exe.$note$,
 'archived','legacy_crm','CDvm9VtyT3iw53iCQ7f7',
 '2026-04-14T08:39:22.634Z','2026-05-21T10:53:37.095Z'),

-- 16
('Belen Monzon','info@cashmovilcanarias.com','+34671659932','Facebook',null,
 'archived','legacy_crm','j1z8dfT569CoXVaByVxb',
 '2026-04-13T18:08:30.706Z','2026-05-12T20:46:51.737Z'),

-- 17
('Jose Javier Lopez Lopez','talleresmeredovegadeo@gmail.com','+34629829469','Facebook',
 'le tenemos que llamar el jueves para hablar bien del tema',
 'archived','legacy_crm','eATew6gnO1ixXEqF4aS3',
 '2026-04-10T14:37:47.891Z','2026-04-13T17:01:00.564Z'),

-- 18
('Vicente Codoñer Senón','acsvm@acsvm.es','+34692974408','Facebook',
 $note$no contesta
le tengo que llamar el miercoles$note$,
 'archived','legacy_crm','drNDDLL99vRO7lCPrfkv',
 '2026-04-09T19:58:50.836Z','2026-04-22T14:45:54.370Z'),

-- 19
('Sate Serveis Assistencials','administracio@sateserveisassistencials.com','+34620581494','Facebook',
 $note$Automatizar procesos. Desarrollar software propio. Llegar al domicilio y en una app escanear documentación. Trabajadora puede escalar valoraciones de caídas, presión... a los scorings. Extraer todo en una visita de una hora.

Calendario con visitas agendadas, poder revalorar para ver diferencias, tema social-salud. Sin nóminas ni RRHH ni contabilidad.

Ahora usan: nada, van con word y copilot, gemini. Comunicación trabajador-cliente. No contesta.$note$,
 'archived','legacy_crm','gPThjEh7ckrCmp5vV5uV',
 '2026-04-09T17:52:29.007Z','2026-04-23T11:10:01.951Z'),

-- 20
('NINFO MANTIS IRIARTE','maitane500@gmail.com','+34600309880','Facebook','no contesta',
 'archived','legacy_crm','DDKU1iJns8yFH1uFKXe9',
 '2026-04-08T17:03:12.342Z','2026-05-27T06:41:33.108Z'),

-- 21
('Juan Garcia','ilovewine@outlook.es','+34637457635','Facebook','Esperando su email',
 'archived','legacy_crm','OcLTYOz9qKXoBCYaOUXq',
 '2026-04-06T16:03:37.241Z','2026-04-28T07:32:28.660Z'),

-- 22
('Juan Carlos Gonzalez','juancarlosgonzalez@torcasa.es','+34636478004','Facebook','llamar a la 13',
 'archived','legacy_crm','UfdLjr5Snlxg76GOpxzA',
 '2026-04-03T07:36:02.775Z','2026-04-22T14:34:15.121Z'),

-- 23
('Luis','misalud.navarra@gmail.com','+34635038537','Facebook','Llamar a las 18 7.4.2026',
 'archived','legacy_crm','1OfjXt3mCKELm3IzXfTS',
 '2026-04-02T10:27:18.111Z','2026-04-22T15:58:03.888Z'),

-- 24
('Ángel','administracion@luisaninteriorismo.com','+34607717991','Facebook',
 $note$Empresa de reformas/interiorismo. Necesitan software para control de costes de obra por empleado (fichar en obra), gestión de gastos, materiales, control de EPIs, seguros de furgonetas con avisos de caducidad. Tienen Excel + agenda. Están valorando otra opción de software. No contesta para la llamada acordada el 8.4.26 a las 13:30.$note$,
 'archived','legacy_crm','JWCM9dBTT06V1Cmd7jBW',
 '2026-03-31T19:55:11.300Z','2026-04-13T14:53:33.413Z'),

-- 25
('Alvaro Rodriguez Poza','alvaro@stinson.solar','+34679650139','Facebook',null,
 'archived','legacy_crm','5r3ce0FOvGUKGY9ilESU',
 '2026-03-29T02:18:22.748Z','2026-04-13T17:09:53.612Z')

on conflict (external_source, external_id)
  where external_id is not null and external_source is not null
  do nothing;
