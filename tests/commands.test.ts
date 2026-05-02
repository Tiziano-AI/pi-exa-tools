import assert from "node:assert/strict";
import test from "node:test";
import { buildFetchCommandFromUrls, parseExaCommandInput } from "../extensions/exa-tools/src/operator-helpers.ts";

test("parseExaCommandInput parses action and remainder", () => {
	const parsed = parseExaCommandInput("search Exa official site");
	assert.equal(parsed.action, "search");
	assert.equal(parsed.remainder, "Exa official site");
});

test("parseExaCommandInput treats unknown action as free remainder", () => {
	const parsed = parseExaCommandInput("nonsense");
	assert.equal(parsed.action, undefined);
	assert.equal(parsed.remainder, "nonsense");
});

test("buildFetchCommandFromUrls returns canonical slash command", () => {
	assert.equal(
		buildFetchCommandFromUrls(["https://exa.ai/", "https://platform.openai.com/docs"]),
		"/exa fetch https://exa.ai/ https://platform.openai.com/docs",
	);
	assert.equal(buildFetchCommandFromUrls([]), undefined);
});
