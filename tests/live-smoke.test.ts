import assert from "node:assert/strict";
import test from "node:test";
import { readExaConfig } from "../extensions/exa-tools/src/config.ts";
import { ExaClient } from "../extensions/exa-tools/src/exa-client.ts";

const config = readExaConfig();
const client = new ExaClient();
const liveSmokeEnabled = process.env.PI_EXA_LIVE_SMOKE === "1";

if (!liveSmokeEnabled) {
	test("live smoke skips unless PI_EXA_LIVE_SMOKE=1", { skip: true }, () => {});
} else if (!config) {
	test("live smoke skips when EXA_API_KEY is absent", { skip: true }, () => {});
} else {
	test("live smoke search and contents calls succeed", async () => {
		const searchResponse = await client.search(
			config,
			{
				query: "Exa official site",
				type: "auto",
				numResults: 1,
				includeDomains: ["exa.ai"],
				contents: { highlights: { maxCharacters: 500 } },
			},
			AbortSignal.timeout(8000),
		);

		assert.ok((searchResponse.results?.length ?? 0) >= 1);
		const firstUrl = searchResponse.results?.[0]?.url;
		assert.ok(typeof firstUrl === "string" && firstUrl.length > 0);

		const contentsResponse = await client.contents(
			config,
			{
				urls: [firstUrl],
				text: { maxCharacters: 500 },
			},
			AbortSignal.timeout(10000),
		);

		assert.ok((contentsResponse.statuses?.length ?? 0) >= 1);
		assert.equal(contentsResponse.statuses?.[0]?.status, "success");
	});
}
