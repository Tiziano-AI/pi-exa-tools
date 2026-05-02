/** Small in-process request lane with bounded concurrency and start spacing. */

interface PendingGrant {
	resolve: () => void;
	reject: (error: Error) => void;
	signal?: AbortSignal;
	aborted: boolean;
	abortListener?: () => void;
}

/**
 * Coordinates outbound requests so parallel Pi tool calls do not immediately hit
 * easy provider-side throttles.
 */
export class RequestLane {
	private readonly maxConcurrent: number;
	private readonly minStartSpacingMs: number;
	private readonly queue: PendingGrant[] = [];
	private activeCount = 0;
	private lastStartAt = 0;
	private drainTimer: NodeJS.Timeout | undefined;

	constructor(maxConcurrent: number, minStartSpacingMs: number) {
		this.maxConcurrent = maxConcurrent;
		this.minStartSpacingMs = minStartSpacingMs;
	}

	/** Runs the task once a lane slot becomes available. */
	async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
		await this.acquire(signal);
		try {
			return await task();
		} finally {
			this.release();
		}
	}

	private acquire(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) {
			return Promise.reject(new Error("Request aborted before lane acquisition."));
		}

		return new Promise((resolve, reject) => {
			const pending: PendingGrant = {
				resolve: () => {
					if (pending.abortListener && pending.signal) {
						pending.signal.removeEventListener("abort", pending.abortListener);
					}
					resolve();
				},
				reject: (error: Error) => {
					if (pending.abortListener && pending.signal) {
						pending.signal.removeEventListener("abort", pending.abortListener);
					}
					reject(error);
				},
				signal,
				aborted: false,
			};

			if (signal) {
				pending.abortListener = () => {
					pending.aborted = true;
					const index = this.queue.indexOf(pending);
					if (index >= 0) {
						this.queue.splice(index, 1);
					}
					pending.reject(new Error("Request aborted while waiting for lane availability."));
				};
				signal.addEventListener("abort", pending.abortListener, { once: true });
			}

			this.queue.push(pending);
			this.drain();
		});
	}

	private release(): void {
		if (this.activeCount > 0) {
			this.activeCount -= 1;
		}
		this.drain();
	}

	private drain(): void {
		while (this.queue.length > 0 && this.queue[0]?.aborted) {
			this.queue.shift();
		}

		if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
			return;
		}

		const now = Date.now();
		const elapsed = now - this.lastStartAt;
		const waitMs = Math.max(0, this.minStartSpacingMs - elapsed);
		if (waitMs > 0) {
			if (!this.drainTimer) {
				this.drainTimer = setTimeout(() => {
					this.drainTimer = undefined;
					this.drain();
				}, waitMs);
			}
			return;
		}

		const next = this.queue.shift();
		if (!next || next.aborted) {
			this.drain();
			return;
		}

		this.activeCount += 1;
		this.lastStartAt = Date.now();
		next.resolve();
		this.drain();
	}
}
