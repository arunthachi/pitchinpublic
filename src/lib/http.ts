/**
 * Parse a fetch Response body as JSON without throwing on empty or non-JSON
 * bodies (proxy error pages, empty 500s), so callers surface a friendly
 * message instead of a SyntaxError.
 */
export async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: response.statusText || 'Unexpected response from the server.',
    };
  }
}
