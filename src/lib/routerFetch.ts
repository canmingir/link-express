const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 1000;
const MAX_DELAY_MS = 30000;

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  const seconds = header === null ? NaN : Number(header);
  const delay =
    Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1000
      : BACKOFF_MS * 2 ** (attempt - 1);

  return Math.min(delay, MAX_DELAY_MS);
}

async function routerFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);

    if (!RETRY_STATUSES.has(response.status) || attempt >= MAX_ATTEMPTS) {
      return response;
    }

    await response.body?.cancel();
    await new Promise((resolve) =>
      setTimeout(resolve, retryDelay(response, attempt))
    );
  }
}

export { routerFetch };
