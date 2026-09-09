/** JSON with bigints as decimal strings, for MCP structured content and CLI output. */
export function toJson(value: unknown, indent = 0): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), indent);
}

export function toJsonObject(value: unknown): Record<string, unknown> {
  return JSON.parse(toJson(value)) as Record<string, unknown>;
}
