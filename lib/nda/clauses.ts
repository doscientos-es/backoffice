export type NdaParty = {
  name: string
  nif?: string | null
  address?: string | null
  representative?: string | null
}

export type NdaData = {
  disclosing: NdaParty
  counterparty: NdaParty
  purpose: string
  confidentialityYears: number
  effectiveDate: string
}

export type NdaClause = { title: string; body: string }

export type NdaDocument = {
  title: string
  intro: string[]
  clauses: NdaClause[]
}

function describeParty(party: NdaParty): string {
  const parts = [party.name.trim()]
  if (party.nif?.trim()) parts.push(`con NIF/CIF ${party.nif.trim()}`)
  if (party.address?.trim())
    parts.push(`y domicilio en ${party.address.trim().replaceAll('\n', ', ')}`)
  const base = parts.join(', ')
  return party.representative?.trim()
    ? `${base}, representada por ${party.representative.trim()}`
    : base
}

export function formatNdaDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Mutual NDA template. The same text is rendered on the public page and in the
 * PDF, so changing the legal wording happens only here.
 */
export function buildNda(data: NdaData): NdaDocument {
  const years = data.confidentialityYears
  const yearsLabel = years === 1 ? 'un (1) año' : `${years} años`
  return {
    title: 'Acuerdo de confidencialidad (NDA)',
    intro: [
      `En ${formatNdaDate(data.effectiveDate)}, de una parte, ${describeParty(data.disclosing)} (en adelante, «Doscientos»), y de otra parte, ${describeParty(data.counterparty)} (en adelante, la «Otra Parte»).`,
      'Ambas partes se reconocen capacidad legal suficiente para obligarse y acuerdan las siguientes cláusulas.',
    ],
    clauses: [
      {
        title: '1. Objeto',
        body: `Las partes desean intercambiar información confidencial con la siguiente finalidad: ${data.purpose.trim()}. Este acuerdo regula cómo debe tratarse esa información.`,
      },
      {
        title: '2. Información confidencial',
        body: 'Es toda información, en cualquier formato, que una parte (la «Parte Reveladora») comunique a la otra (la «Parte Receptora»), incluida información técnica, comercial, financiera, de clientes, de producto, código fuente, precios y propuestas. Se excluye la información que sea o llegue a ser pública sin culpa de la Parte Receptora, la que ya conociera legítimamente, la recibida de un tercero sin deber de confidencialidad y la desarrollada de forma independiente.',
      },
      {
        title: '3. Obligaciones',
        body: 'La Parte Receptora se compromete a: (a) usar la información solo para la finalidad indicada; (b) no revelarla a terceros sin autorización previa y por escrito; (c) limitar el acceso a sus empleados y colaboradores que necesiten conocerla y estén sujetos a una obligación equivalente; (d) protegerla con medidas razonables, al menos las que aplica a su propia información confidencial.',
      },
      {
        title: '4. Divulgación exigida por ley',
        body: 'Si una autoridad competente exige revelar información confidencial, la Parte Receptora avisará cuanto antes a la Parte Reveladora, siempre que la ley lo permita, y revelará solo lo estrictamente necesario.',
      },
      {
        title: '5. Duración',
        body: `El acuerdo entra en vigor en la fecha indicada y las obligaciones de confidencialidad se mantendrán durante ${yearsLabel} desde esa fecha, incluso si la relación entre las partes termina antes.`,
      },
      {
        title: '6. Devolución o destrucción',
        body: 'A petición de la Parte Reveladora, la Parte Receptora devolverá o destruirá la información confidencial y las copias que conserve, salvo las que deba guardar por obligación legal.',
      },
      {
        title: '7. Propiedad y sin licencia',
        body: 'La información sigue siendo propiedad de la Parte Reveladora. Este acuerdo no concede licencia ni derecho alguno sobre ella, ni obliga a las partes a contratar entre sí.',
      },
      {
        title: '8. Protección de datos',
        body: 'Si la información incluye datos personales, cada parte los tratará conforme al Reglamento (UE) 2016/679 y a la Ley Orgánica 3/2018, y solo para la finalidad indicada.',
      },
      {
        title: '9. Ley aplicable y jurisdicción',
        body: 'Este acuerdo se rige por la ley española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de Barcelona, con renuncia a cualquier otro fuero que pudiera corresponderles.',
      },
    ],
  }
}
