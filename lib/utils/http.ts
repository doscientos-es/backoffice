export async function readJsonResponse<T = any>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(response.ok ? 'El servidor devolvió una respuesta no válida.' : fallbackMessage)
  }
}
