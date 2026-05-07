import assert from "node:assert/strict";
import { DEFAULT_MAX_BYTES } from "@earendil-works/pi-coding-agent";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runFetchRequest } from "../extensions/exa-tools/src/operations.ts";
import { PREVIEW_BYTES_ENV, PREVIEW_LINES_ENV } from "../extensions/exa-tools/src/preview-limits.ts";

interface JsonServer {
	baseUrl: string;
	requests: unknown[];
	close: () => Promise<void>;
}

test("runFetchRequest applies lower preview caps and points the model at readable full output", async () => {
	const restoreEnv = setEnv({
		[PREVIEW_LINES_ENV]: "8",
		[PREVIEW_BYTES_ENV]: "4096",
	});
	const server = await createJsonServer((path, body) => {
		assert.equal(path, "/contents");
		assertRequestedUrl(body, "https://example.com/article");
		return {
			requestId: "req_preview",
			results: [
				{
					url: "https://example.com/article",
					title: "Long article",
					text: Array.from({ length: 30 }, (_value, index) => `fetch line ${index + 1}`).join("\n"),
				},
			],
			statuses: [{ id: "https://example.com/article", status: "success" }],
		};
	});

	try {
		const result = await runFetchRequest({ apiKey: "test-key", baseUrl: server.baseUrl }, { urls: ["https://example.com/article"] });

		assert.match(result.outputText, /Output truncated/);
		assert.match(result.outputText, /Full output saved to:/);
		assert.match(result.outputText, /Use the read tool on that path if you need omitted content/);
		assert.doesNotMatch(result.outputText, /fetch line 30/);
		assert.equal(result.details.truncation?.maxLines, 8);
		assert.equal(result.details.truncation?.maxBytes, 4096);
		assert.equal(result.details.truncation?.truncatedBy, "lines");
		assert.equal(server.requests.length, 1);
		assert.ok(result.details.fullOutputPath);
		const fullOutput = await readFile(result.details.fullOutputPath, "utf8");
		assert.match(fullOutput, /fetch line 30/);
	} finally {
		restoreEnv();
		await server.close();
	}
});

test("runFetchRequest preserves read guidance when preview limits are tiny", async () => {
	const restoreEnv = setEnv({
		[PREVIEW_LINES_ENV]: "1",
		[PREVIEW_BYTES_ENV]: "1",
	});
	const server = await createJsonServer((path, body) => {
		assert.equal(path, "/contents");
		assertRequestedUrl(body, "https://example.com/tiny");
		return {
			requestId: "req_tiny",
			results: [
				{
					url: "https://example.com/tiny",
					title: "Tiny preview article",
					text: "important omitted evidence",
				},
			],
			statuses: [{ id: "https://example.com/tiny", status: "success" }],
		};
	});

	try {
		const result = await runFetchRequest({ apiKey: "test-key", baseUrl: server.baseUrl }, { urls: ["https://example.com/tiny"] });

		assert.match(result.outputText, /No complete line fit/);
		assert.match(result.outputText, /Use the read tool on that path/);
		assert.ok(Buffer.byteLength(result.outputText, "utf8") < DEFAULT_MAX_BYTES);
		assert.equal(result.details.truncation?.outputLines, 0);
		assert.equal(result.details.truncation?.maxLines, 1);
		assert.equal(result.details.truncation?.maxBytes, 1);
		assert.ok(result.details.fullOutputPath);
		const fullOutput = await readFile(result.details.fullOutputPath, "utf8");
		assert.match(fullOutput, /important omitted evidence/);
	} finally {
		restoreEnv();
		await server.close();
	}
});

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

async function createJsonServer(handler: (path: string, body: unknown) => unknown): Promise<JsonServer> {
	const requests: unknown[] = [];
	const server = createServer((request: IncomingMessage, response: ServerResponse) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});
		request.on("end", () => {
			const path = request.url ?? "";
			const text = Buffer.concat(chunks).toString("utf8");
			const body: unknown = text.length > 0 ? JSON.parse(text) : {};
			requests.push(body);
			const payload = handler(path, body);
			response.writeHead(200, { "content-type": "application/json" });
			response.end(JSON.stringify(payload));
		});
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});

	const address = server.address();
	if (typeof address !== "object" || address === null || !("port" in address)) {
		server.close();
		throw new Error("Test server did not bind to a TCP port.");
	}
	const tcpAddress = address as AddressInfo;

	return {
		baseUrl: `http://127.0.0.1:${tcpAddress.port}`,
		requests,
		close: () => new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		}),
	};
}

function assertRequestedUrl(body: unknown, expectedUrl: string): void {
	assert.equal(typeof body === "object" && body !== null, true);
	assert.equal("urls" in body, true);
	const urls = body.urls;
	assert.equal(Array.isArray(urls), true);
	assert.equal(urls[0], expectedUrl);
}
