/**
 * typesafe-api.ts
 * ---------------
 * The HTTP half of asking TypeSafe's System One endpoint a question. No
 * judgement lives here — what a request asks and what its answers mean is
 * `highlight-judge-core.ts` — the split `cbf-api.ts` and `commons-api.ts`
 * already draw, for the reason they give.
 *
 * Written against `fetch` rather than `@typesafe-ai/sdk`: one endpoint, one
 * verb, and a repository that hand-writes its transports (`cbf-api.ts`,
 * `youtube-api.ts`) rather than taking a client dependency to reach them.
 * Contract read from https://docs.typesafe.ai/api.md on 2026-09-29.
 *
 * **Workstation only, like every script that calls a third party here.** The
 * key is read from `TYPESAFE_API_KEY` and never logged; nothing the server
 * runs imports this file.
 */
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export interface SystemOneResponse {
  model: string;
  answers: Record<string, unknown>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429 is the rate limit and 529 "overloaded"; the docs ask for exponential
 *  backoff on both. 401 and 422 are our fault and will not improve. */
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

export const typesafeKey = (): string | null => {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  return key ? key : null;
};

export const askSystemOne = async (
  body: unknown,
  key: string,
  attempts = 4,
): Promise<SystemOneResponse> => {
  let last: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(TYPESAFE_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return (await response.json()) as SystemOneResponse;

      // The response body is where a 422 names the field it refused. The
      // request is never echoed, so nothing printed can carry the key.
      const detail = (await response.text()).slice(0, 300);
      const error = new Error(`TypeSafe answered ${response.status}: ${detail}`);
      if (!RETRYABLE.has(response.status)) throw error;
      last = error;
    } catch (error) {
      last = error;
      if (error instanceof Error && /answered (401|403|422)/.test(error.message)) throw error;
    }
    if (attempt < attempts) await sleep(2 ** attempt * 1000);
  }

  throw last instanceof Error ? last : new Error(String(last));
};
