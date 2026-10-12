export type TimedEventInterval = {
  id: string
  start: number
  end: number
}

export type TimedEventPosition = {
  column: number
  columnCount: number
}

const MIN_VISIBLE_DURATION = 20 * 60_000

/** Assigns overlapping events to side-by-side columns, reusing columns when possible. */
export function layoutOverlappingEvents(
  events: readonly TimedEventInterval[],
): Map<string, TimedEventPosition> {
  const sorted = events
    .map((event) => ({
      ...event,
      end: Math.max(event.end, event.start + MIN_VISIBLE_DURATION),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))

  const positions = new Map<string, TimedEventPosition>()
  let cluster: typeof sorted = []
  let clusterEnd = Number.NEGATIVE_INFINITY

  function assignCluster() {
    const columnEnds: number[] = []
    const assigned: { id: string; column: number }[] = []

    for (const event of cluster) {
      let column = columnEnds.findIndex((end) => end <= event.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(event.end)
      } else {
        columnEnds[column] = event.end
      }
      assigned.push({ id: event.id, column })
    }

    for (const { id, column } of assigned) {
      positions.set(id, { column, columnCount: columnEnds.length })
    }
    cluster = []
    clusterEnd = Number.NEGATIVE_INFINITY
  }

  for (const event of sorted) {
    if (cluster.length > 0 && event.start >= clusterEnd) assignCluster()
    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, event.end)
  }
  if (cluster.length > 0) assignCluster()

  return positions
}
