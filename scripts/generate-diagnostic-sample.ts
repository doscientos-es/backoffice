import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { renderDiagnosticPdf } from '../lib/diagnostics/report'

const output = path.join(process.cwd(), 'docs', 'diagnostico-lead-ejemplo.pdf')

const pdf = await renderDiagnosticPdf({
  name: 'Marta Soler',
  company: 'Fincas Soler',
  answers: {
    proceso: 'Recoger solicitudes de visita y asignarlas al agente adecuado',
    personas: 4,
    minutos_por_vez: 12,
    veces_por_semana: 45,
    coste_hora: 25,
    impacto: 'Retrasos y seguimiento manual',
  },
  metrics: {
    monthlyHours: 156,
    yearlyHours: 1872,
    yearlyCost: 46800,
    risk: 'Alta',
    primaryOpportunity:
      'Centralizar solicitudes y automatizar la asignación y el seguimiento de cada visita.',
  },
})

await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, pdf)
console.log(`PDF de muestra generado: ${output}`)
