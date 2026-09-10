'use client'

import { Database as DatabaseBackup, Download, LoaderCircle as Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

import { triggerBackofficeBackup } from './actions'

type ExportTable = { value: string; label: string }

export function BackupActions({
  runnerConfigured,
  tables,
  showBackupAction = true,
  showExportActions = true,
  canIncludePii = false,
}: {
  runnerConfigured: boolean
  tables: readonly ExportTable[]
  showBackupAction?: boolean
  showExportActions?: boolean
  canIncludePii?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [table, setTable] = useState(tables[0]?.value ?? '')
  const [includePii, setIncludePii] = useState(false)

  function forceBackup() {
    startTransition(async () => {
      const result = await triggerBackofficeBackup()
      if (result.ok) sileo.success({ title: 'Copia de seguridad iniciada' })
      else sileo.error({ title: result.error })
    })
  }

  function exportData(format: 'json' | 'csv') {
    startTransition(async () => {
      const response = await fetch('/api/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, table: format === 'csv' ? table : undefined, includePii }),
      })
      const result = (await response.json().catch(() => null)) as { downloadUrl?: string; error?: string } | null
      if (!response.ok || !result?.downloadUrl) {
        sileo.error({ title: result?.error ?? 'No se pudo preparar la exportación' })
        return
      }
      window.location.assign(result.downloadUrl)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {showBackupAction ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={forceBackup}
            disabled={!runnerConfigured || pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}
            {pending ? 'Creando copia…' : 'Crear copia ahora'}
          </Button>
          {!runnerConfigured ? (
            <span className="text-muted-foreground text-xs">
              La copia automática se activará al configurar el runner.
            </span>
          ) : null}
        </div>
      ) : null}

      {showExportActions ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => exportData('json')}>
            <Download className="size-4" />
            Descargar datos actuales (JSON)
          </Button>
          <Select
            value={table}
            onChange={(event) => setTable(event.target.value)}
            aria-label="Tabla actual para exportar como CSV"
            className="w-52"
          >
            {tables.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" disabled={!table || pending} onClick={() => exportData('csv')}>
            <Download className="size-4" />
            Descargar datos actuales (CSV / Excel)
          </Button>
          {canIncludePii ? (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includePii}
                onChange={(event) => setIncludePii(event.target.checked)}
                className="accent-primary size-4"
              />
              Incluir datos personales
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
