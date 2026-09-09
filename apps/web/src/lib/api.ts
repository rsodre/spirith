import { parseJson } from './json';

// The one `fetch` for the app's own query routes (`nextjs` skill part 2 §1). Every read hook
// in hooks/queries goes through here; nothing else calls fetch.
export async function fetchQuery<T>(path: string): Promise<T> {
  const url = `/api/query/${path}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const text = await response.text();
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = JSON.parse(text) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    console.error('[API Error]', { url, status: response.status, message });
    throw new Error(message);
  }
  return parseJson<T>(text);
}
