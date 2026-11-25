export async function uploadAttachment(
  file: File,
  entityType: string,
  entityId: string,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  const data = new FormData()
  data.set('file', file)
  data.set('entityType', entityType)
  data.set('entityId', entityId)

  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/attachments/upload')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.floor((event.loaded / event.total) * 100)))
      }
    }
    request.onload = () => {
      let result: unknown = null
      try {
        result = JSON.parse(request.responseText) as unknown
      } catch {
        // Proxies can return non-JSON error responses.
      }
      const payload =
        result && typeof result === 'object' ? (result as Record<string, unknown>) : null
      resolve(
        request.status >= 200 &&
          request.status < 300 &&
          typeof payload?.id === 'string' &&
          payload.id
          ? null
          : typeof payload?.error === 'string'
            ? payload.error
            : 'No se pudo subir el archivo',
      )
    }
    request.onerror = () =>
      resolve('Error de red. Comprueba si el archivo se ha subido antes de reintentar.')
    request.onabort = () => resolve('La subida se ha cancelado')
    request.send(data)
  })
}
