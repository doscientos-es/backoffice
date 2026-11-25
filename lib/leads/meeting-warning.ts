export function meetingRecordingWarning(result: {
  interactionRecorded: boolean
  internalReminderCreated: boolean
}): string | null {
  const missing = [
    !result.interactionRecorded && 'la actividad del lead',
    !result.internalReminderCreated && 'el aviso para el tablero',
  ].filter(Boolean)
  if (!missing.length) return null
  return `La reunión ya está en Calendar, pero no se pudo guardar ${missing.join(' ni ')}. No vuelvas a crearla; revisa el lead y añade el aviso manualmente si falta.`
}
