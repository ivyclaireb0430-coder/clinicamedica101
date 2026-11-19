export const SCRIPT_PLACEHOLDERS = ["first_name", "date", "time"] as const;

/** Replace {first_name}, {date}, {time}. Unknown or missing placeholders are left visible. */
export function renderScript(body: string, values: Partial<Record<string, string>>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function placeholdersIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

/** Text in [brackets] the clinic was meant to fill in, e.g. "[fee]" or "[Room/Unit]". */
export function unfilledBlanks(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{1,40}\]/g) ?? [])];
}
