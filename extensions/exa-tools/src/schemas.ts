/** TypeBox schemas for Pi tool registration. */

import { Type } from "typebox";

/** Parameters for the `exa_search` Pi tool. */
export const ExaSearchSchema = Type.Object({
	query: Type.String({ description: "Natural-language search query." }),
	includeDomains: Type.Optional(
		Type.Array(Type.String({ description: "Domain or URL filter." }), {
			maxItems: 20,
			description: "Optional source filters such as openai.com or https://docs.exa.ai/reference.",
		}),
	),
});

/** Parameters for the `exa_fetch` Pi tool. */
export const ExaFetchSchema = Type.Object({
	urls: Type.Array(Type.String({ description: "Absolute http or https URL." }), {
		minItems: 1,
		maxItems: 7,
		description: "One to seven URLs to extract clean text from.",
	}),
});
