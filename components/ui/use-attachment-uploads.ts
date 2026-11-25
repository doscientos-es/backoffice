'use client'

import { useRef, useState } from 'react'

import { uploadAttachment } from '@/lib/attachments/upload'

type UploadEntry = {
  id: number
  file: File
  status: 'queued' | 'uploading' | 'error'
  percent: number
  error?: string
}

export function useAttachmentUploads(entityType: string, entityId: string, onSettled: () => void) {
  const nextId = useRef(0)
  const busy = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [entries, setEntries] = useState<UploadEntry[]>([])

  async function run(batch: UploadEntry[]) {
    if (!batch.length || busy.current) return
    busy.current = true
    setUploading(true)
    setProgress({ done: 0, total: batch.length })
    try {
      let done = 0
      for (const entry of batch) {
        setEntries((current) =>
          current.map((item) =>
            item.id === entry.id
              ? { ...item, status: 'uploading', percent: 0, error: undefined }
              : item,
          ),
        )
        let error: string | null
        try {
          error = await uploadAttachment(entry.file, entityType, entityId, (percent) => {
            setEntries((current) =>
              current.map((item) => (item.id === entry.id ? { ...item, percent } : item)),
            )
          })
        } catch {
          error = 'Error de red. Comprueba si el archivo se ha subido antes de reintentar.'
        }
        setEntries((current) =>
          error
            ? current.map((item) =>
                item.id === entry.id ? { ...item, status: 'error', error } : item,
              )
            : current.filter((item) => item.id !== entry.id),
        )
        setProgress({ done: ++done, total: batch.length })
      }
    } finally {
      busy.current = false
      setUploading(false)
      setProgress(null)
      onSettled()
    }
  }

  function add(files: File[]) {
    if (!files.length || busy.current) return
    const batch: UploadEntry[] = files.map((file) => ({
      id: ++nextId.current,
      file,
      status: 'queued',
      percent: 0,
    }))
    setEntries((current) => [...current, ...batch])
    void run(batch)
  }

  function retry(entry: UploadEntry) {
    if (entry.status !== 'error' || busy.current) return
    void run([entry])
  }

  function dismiss(id: number) {
    setEntries((current) => current.filter((entry) => entry.id !== id || entry.status !== 'error'))
  }

  return { uploading, progress, entries, add, retry, dismiss }
}
