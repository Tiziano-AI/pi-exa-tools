import assert from "node:assert/strict";
import test from "node:test";
import { mapFetchInput, mapSearchInput } from "../extensions/exa-tools/src/mappers.ts";

test("mapSearchInput applies canonical discovery defaults", () => {
	const mapped = mapSearchInput({ query: "OpenAI Responses API docs" });
	assert.equal(mapped.payload.query, "OpenAI Responses API docs");
	assert.equal(mapped.payload.type, "auto");
	assert.equal(mapped.payload.numResults, 10);
	assert.deepEqual(mapped.payload.contents, {
		highlights: { maxCharacters: 4000 },
	});
	assert.equal(mapped.normalized.resultCount, 10);
	assert.equal(mapped.normalized.maxCharacters, 4000);
});

test("mapSearchInput normalizes includeDomains", () => {
	const mapped = mapSearchInput({
		query: "Responses API docs",
		includeDomains: ["HTTPS://Developers.OpenAI.com/docs/", "developers.openai.com/docs", ""],
	});
	assert.deepEqual(mapped.payload.includeDomains, ["developers.openai.com/docs"]);
	assert.deepEqual(mapped.normalized.includeDomains, ["developers.openai.com/docs"]);
});

test("mapSearchInput rejects more than twenty includeDomains", () => {
	assert.throws(
		() => mapSearchInput({
			query: "Responses API docs",
			includeDomains: Array.from({ length: 21 }, (_value, index) => `example${index}.com`),
		}),
		/at most 20/,
	);
});

test("mapFetchInput normalizes URL and defaults to text", () => {
	const mapped = mapFetchInput({ urls: ["https://exa.ai/#pricing"] });
	assert.equal(mapped.payload.urls.length, 1);
	assert.equal(mapped.payload.urls[0], "https://exa.ai/");
	assert.deepEqual(mapped.payload.text, { maxCharacters: 8000 });
	assert.equal(mapped.normalized.maxCharacters, 8000);
});

test("mapFetchInput rejects more than seven URLs", () => {
	assert.throws(
		() => mapFetchInput({
			urls: [
				"https://example.com/1",
				"https://example.com/2",
				"https://example.com/3",
				"https://example.com/4",
				"https://example.com/5",
				"https://example.com/6",
				"https://example.com/7",
				"https://example.com/8",
			],
		}),
		/at most 7/,
	);
});
