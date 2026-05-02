import assert from "node:assert/strict";
import test from "node:test";
import { formatContentsResponse, formatSearchResponse } from "../extensions/exa-tools/src/format.ts";

test("formatSearchResponse summarizes ranked search results without model-facing cost", () => {
	const formatted = formatSearchResponse(
		{
			requestId: "req_123",
			searchType: "auto",
			costDollars: { total: 0.003 },
			results: [
				{
					title: "OpenAI Responses API",
					url: "https://platform.openai.com/docs/api-reference/responses",
					highlights: ["Use the Responses API for multimodal and tool-enabled workflows."],
				},
			],
		},
		{
			query: "OpenAI Responses API docs",
			resultCount: 10,
			includeDomains: [],
			maxCharacters: 4000,
		},
	);

	assert.match(formatted.text, /returned 1 result/);
	assert.match(formatted.text, /OpenAI Responses API/);
	assert.doesNotMatch(formatted.text, /Cost|\$0\.003/);
	assert.equal(formatted.details.items.length, 1);
	assert.equal(formatted.details.requestId, "req_123");
	assert.equal(formatted.details.costTotal, 0.003);
});

test("formatContentsResponse keeps per-url status information without model-facing cost", () => {
	const formatted = formatContentsResponse(
		{
			requestId: "req_456",
			costDollars: { total: 0.001 },
			results: [
				{
					title: "Exa",
					url: "https://exa.ai/",
					text: "Exa is a search engine made for AIs.",
				},
			],
			statuses: [
				{ id: "https://exa.ai/", status: "success" },
				{
					id: "https://example.com/missing",
					status: "error",
					error: { tag: "CRAWL_NOT_FOUND", httpStatusCode: 404 },
				},
			],
		},
		{
			urls: ["https://exa.ai/", "https://example.com/missing"],
			maxCharacters: 8000,
		},
	);

	assert.match(formatted.text, /1 success, 1 error/);
	assert.match(formatted.text, /CRAWL_NOT_FOUND/);
	assert.doesNotMatch(formatted.text, /Cost|\$0\.001/);
	assert.equal(formatted.details.successCount, 1);
	assert.equal(formatted.details.errorCount, 1);
	assert.equal(formatted.details.costTotal, 0.001);
	assert.equal(formatted.details.items[1]?.errorTag, "CRAWL_NOT_FOUND");
});
