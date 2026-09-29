-- Make the client ownership of project source code and fake-data demos explicit
-- in the default contractual annex for newly created proposals.
do $$
declare
  current_default text;
begin
  select pg_get_expr(adbin, adrelid)
    into current_default
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.adnum
   where c.relname = 'proposals'
     and a.attname = 'legal_terms';

  if current_default is null
     or position('Propiedad intelectual' in current_default) = 0
     or position('Caso de éxito' in current_default) = 0 then
    raise exception 'Unexpected proposals.legal_terms default while applying source code and demo terms';
  end if;

  current_default := replace(
    current_default,
    '9. **Propiedad intelectual.** Una vez abonado íntegramente el precio, Doscientos cede al Cliente los derechos de explotación necesarios sobre los desarrollos creados específicamente para este proyecto —reproducción, distribución, comunicación pública y transformación— para cualquier territorio y durante el máximo plazo legal. Quedan excluidos y seguirán siendo titularidad de Doscientos sus herramientas, bibliotecas, plantillas, componentes genéricos, metodologías, conocimientos previos y mejoras reutilizables, que Doscientos podrá usar y adaptar en otros proyectos, sin revelar información confidencial del Cliente. Los componentes de terceros se regirán por sus propias licencias.',
    '9. **Código fuente y propiedad intelectual.** Una vez abonado íntegramente el precio, el código fuente creado específicamente para este proyecto y los derechos de explotación necesarios sobre dichos desarrollos —reproducción, distribución, comunicación pública y transformación— corresponderán al Cliente para cualquier territorio y durante el máximo plazo legal. Doscientos conserva la titularidad de sus herramientas, bibliotecas, plantillas, componentes genéricos, metodologías, conocimientos previos y mejoras reutilizables, y podrá utilizar y adaptar ese know-how abstracto en otros proyectos, sin reutilizar el código fuente específico del Cliente ni revelar su información confidencial. Los componentes de terceros se regirán por sus propias licencias.'
  );
  current_default := replace(
    current_default,
    '13. **Caso de éxito.** Salvo pacto escrito distinto, el Cliente autoriza a Doscientos a describir la colaboración como caso de éxito y a mostrar los entregables ya hechos públicos, su denominación, marcas y logotipos, exclusivamente para acreditar su experiencia profesional. Doscientos no divulgará información confidencial, datos personales ni métricas no públicas, y atenderá las objeciones razonables y justificadas del Cliente cuando exista un riesgo legítimo para su seguridad, sus secretos empresariales o el cumplimiento normativo.',
    '13. **Casos de éxito y demostraciones.** Salvo pacto escrito distinto, el Cliente autoriza a Doscientos a describir la colaboración como caso de éxito y a mostrar los entregables ya hechos públicos, su denominación, marcas y logotipos, exclusivamente para acreditar su experiencia profesional. Doscientos también podrá crear y publicar demostraciones del producto o del trabajo realizado, incluso en Instagram y otras redes sociales, siempre que utilicen datos ficticios y no revelen información confidencial, datos personales ni métricas no públicas. Doscientos atenderá las objeciones razonables y justificadas del Cliente cuando exista un riesgo legítimo para su seguridad, sus secretos empresariales o el cumplimiento normativo.'
  );

  execute format(
    'alter table public.proposals alter column legal_terms set default %s',
    current_default
  );
end;
$$;
