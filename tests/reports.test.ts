import assert from "node:assert/strict";
import test from "node:test";
import { renderStatusReport } from "../extensions/exa-tools/src/reports.ts";
import { PREVIEW_BYTES_ENV, PREVIEW_LINES_ENV } from "../extensions/exa-tools/src/preview-limits.ts";
import type { ExaAuthState } from "../extensions/exa-tools/src/config.ts";

test("renderStatusReport shows effective preview limits and follow-up read guidance", () => {
	const restoreEnv = setEnv({
		[PREVIEW_LINES_ENV]: "40",
		[PREVIEW_BYTES_ENV]: "2048",
	});
	try {
		const report = renderStatusReport("/tmp/project", createAuthState(), { enabled: true }, { kind: "not-run" });

		assert.match(report, /Output preview/);
		assert.match(report, /first 40 lines or 2\.0KB/);
		assert.match(report, new RegExp(PREVIEW_LINES_ENV));
		assert.match(report, new RegExp(PREVIEW_BYTES_ENV));
		assert.match(report, /use read on that path/);
	} finally {
		restoreEnv();
	}
});

function createAuthState(): ExaAuthState {
	return {
		config: {
			apiKey: "test-key",
			baseUrl: "https://api.exa.ai",
		},
		apiKeySource: "env",
		baseUrlSource: "default",
		authFilePath: "/tmp/pi-exa-tools.env",
		authFileExists: false,
		authFileText: undefined,
	};
}

function setEnv(overrides: Record<string, string>): () => void {
	const previous = new Map<string, string | undefined>();
	for (const name of Object.keys(overrides)) {
		previous.set(name, process.env[name]);
		process.env[name] = overrides[name];
	}
	return () => {
		for (const [name, value] of previous) {
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
	};
}
