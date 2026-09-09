// JSON that survives bigint. The API query routes serialise chain numerics with this, the
// query hooks parse them back, so `@spirith/core` types cross the server/client boundary intact.
const TAG = '$bigint';

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? { [TAG]: v.toString() } : v));
}

function isTagged(v: unknown): v is { [TAG]: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    TAG in v &&
    Object.keys(v).length === 1 &&
    typeof (v as Record<string, unknown>)[TAG] === 'string'
  );
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text, (_key, v) => (isTagged(v) ? BigInt(v[TAG]) : v)) as T;
}
