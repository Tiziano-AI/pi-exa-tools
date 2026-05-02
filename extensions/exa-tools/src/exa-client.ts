/** Direct HTTP client for Exa `/search` and `/contents`. */

import {
	type ExaContentsRequest,
	type ExaContentsResponse,
	type ExaErrorBody,
	type ExaSearchRequest,
	type ExaSearchResponse,
} from "./api-types.ts";
import type { ExaConfig } from "./config.ts";
import { RequestLane } from "./rate-limit.ts";

const DEFAULT_MAX_ATTEMPTS = 3;
const SEARCH_LANE = new RequestLane(3, 120);
const CONTENTS_LANE = new RequestLane(8, 20);

/** Structured Exa request failure with retryability metadata. */
export class ExaRequestError extends Error {
	readonly status: number;
	readonly requestId?: string;
	readonly tag?: string;
	readonly retryable: boolean;

	constructor(message: string, status: number, retryable: boolean, requestId?: string, tag?: string) {
		super(message);
		this.name = "ExaRequestError";
		this.status = status;
		this.retryable = retryable;
		this.requestId = requestId;
		this.tag = tag;
	}
}

/** Shared Exa client with conservative endpoint-specific request lanes. */
export class ExaClient {
	/** Executes a lane-limited Exa `/search` request. */
	async search(config: ExaConfig, payload: ExaSearchRequest, signal?: AbortSignal): Promise<ExaSearchResponse> {
		return SEARCH_LANE.run(() => this.requestJson<ExaSearchResponse>(config, "/search", payload, signal), signal);
	}

	/** Executes a lane-limited Exa `/contents` request. */
	async contents(config: ExaConfig, payload: ExaContentsRequest, signal?: AbortSignal): Promise<ExaContentsResponse> {
		return CONTENTS_LANE.run(() => this.requestJson<ExaContentsResponse>(config, "/contents", payload, signal), signal);
	}

	private async requestJson<T>(
		config: ExaConfig,
		path: "/search" | "/contents",
		payload: ExaSearchRequest | ExaContentsRequest,
		signal?: AbortSignal,
	): Promise<T> {
		let lastError: Error | undefined;
		for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS; attempt += 1) {
			if (signal?.aborted) {
				throw new Error("Request aborted before Exa HTTP call started.");
			}

			try {
				const response = await fetch(`${config.baseUrl}${path}`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						"x-api-key": config.apiKey,
					},
					body: JSON.stringify(payload),
					signal,
				});

				if (!response.ok) {
					const error = await this.buildRequestError(response);
					if (error.retryable && attempt < DEFAULT_MAX_ATTEMPTS) {
						await waitForRetry(response, attempt, signal);
						lastError = error;
						continue;
					}
					throw error;
				}

				return (await response.json()) as T;
			} catch (error) {
				if (signal?.aborted) {
					throw new Error("Request aborted during Exa HTTP call.");
				}

				if (error instanceof ExaRequestError) {
					throw error;
				}

				if (isRetryableNetworkError(error) && attempt < DEFAULT_MAX_ATTEMPTS) {
					await waitForRetry(undefined, attempt, signal);
					lastError = error instanceof Error ? error : new Error(String(error));
					continue;
				}

				throw error instanceof Error ? error : new Error(String(error));
			}
		}

		throw lastError ?? new Error("Exa request failed without a captured error.");
	}

	private async buildRequestError(response: Response): Promise<ExaRequestError> {
		const rawText = await response.text();
		const body = parseExaErrorBody(rawText);
		const message = body?.error?.trim() || `Exa request failed with HTTP ${response.status}.`;
		const retryable = isRetryableStatus(response.status);
		return new ExaRequestError(message, response.status, retryable, body?.requestId, body?.tag);
	}
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status === 500 || status === 502 || status === 503;
}

function parseExaErrorBody(text: string): ExaErrorBody | undefined {
	if (text.trim().length === 0) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text) as ExaErrorBody;
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
		return undefined;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { error: `${text}\n[Failed to parse Exa error body as JSON: ${message}]` };
	}
}

function isRetryableNetworkError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return message.includes("fetch failed") || message.includes("network") || message.includes("timeout");
}

async function waitForRetry(response: Response | undefined, attempt: number, signal?: AbortSignal): Promise<void> {
	const retryAfterMs = getRetryAfterMs(response);
	const defaultBackoffMs = 250 * 2 ** (attempt - 1);
	const waitMs = retryAfterMs ?? defaultBackoffMs;
	await sleep(waitMs, signal);
}

function getRetryAfterMs(response: Response | undefined): number | undefined {
	const retryAfter = response?.headers.get("retry-after");
	if (!retryAfter) {
		return undefined;
	}
	const asSeconds = Number.parseInt(retryAfter, 10);
	if (Number.isFinite(asSeconds)) {
		return Math.max(0, asSeconds * 1000);
	}
	const asDate = Date.parse(retryAfter);
	if (Number.isNaN(asDate)) {
		return undefined;
	}
	return Math.max(0, asDate - Date.now());
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) {
		return Promise.resolve();
	}
	if (signal?.aborted) {
		return Promise.reject(new Error("Retry wait aborted before sleep started."));
	}

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			if (abortListener) {
				signal?.removeEventListener("abort", abortListener);
			}
			resolve();
		}, ms);

		const abortListener = signal
			? () => {
				clearTimeout(timeout);
				signal.removeEventListener("abort", abortListener);
				reject(new Error("Retry wait aborted."));
			}
			: undefined;

		if (abortListener) {
			signal.addEventListener("abort", abortListener, { once: true });
		}
	});
}
