-- ============================================================
-- lead_interactions: permitir registrar emails entrantes
-- ============================================================
-- Hasta ahora el enum interaction_type sólo cubría emails salientes
-- (email_sent + estados de Resend). Añadimos email_received para que
-- el usuario pueda registrar manualmente respuestas o emails recibidos
-- fuera de la app (gestor de correo, móvil, etc.) y mantener el
-- historial completo del lead.

alter type public.interaction_type add value if not exists 'email_received';
