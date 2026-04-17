/**
 * Minimal CSV builder — no external dependencies.
 * Escapes values by wrapping in quotes and doubling internal quotes.
 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  function escape(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines: string[] = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ]
  return lines.join("\n")
}
