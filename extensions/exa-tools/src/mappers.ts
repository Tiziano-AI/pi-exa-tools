/** Input normalization and safe request mapping for Exa tool calls. */

import type { ExaContentsRequest, ExaSearchRequest } from "./api-types.ts";
import type { ExaFetchInput, ExaSearchInput, FetchMappingResult, SearchMappingResult } from "./tool-types.ts";

const DEFAULT_SEARCH_RESULTS = 10;
const DEFAULT_SEARCH_HIGHLIGHTS_CHARACTERS = 4000;
const DEFAULT_FETCH_TEXT_CHARACTERS = 8000;
const MAX_INCLUDE_DOMAINS = 20;
const MAX_FETCH_URLS = 7;

/** Maps Pi tool input to the canonical Exa `/search` request. */
export function mapSearchInput(input: ExaSearchInput): { payload: ExaSearchRequest; normalized: SearchMappingResult } {
	const query = requireNonEmptyQuery(input.query);
	const includeDomains = normalizeDomainFilters(input.includeDomains);
	const payload: ExaSearchRequest = {
		query,
		type: "auto",
		numResults: DEFAULT_SEARCH_RESULTS,
		contents: {
			highlights: { maxCharacters: DEFAULT_SEARCH_HIGHLIGHTS_CHARACTERS },
		},
	};

	if (includeDomains.length > 0) {
		payload.includeDomains = includeDomains;
	}

	return {
		payload,
		normalized: {
			query,
			resultCount: DEFAULT_SEARCH_RESULTS,
			includeDomains,
			maxCharacters: DEFAULT_SEARCH_HIGHLIGHTS_CHARACTERS,
		},
	};
}

/** Maps Pi tool input to the canonical Exa `/contents` request. */
export function mapFetchInput(input: ExaFetchInput): { payload: ExaContentsRequest; normalized: FetchMappingResult } {
	const urls = normalizeUrls(input.urls);
	return {
		payload: {
			urls,
			text: { maxCharacters: DEFAULT_FETCH_TEXT_CHARACTERS },
		},
		normalized: {
			urls,
			maxCharacters: DEFAULT_FETCH_TEXT_CHARACTERS,
		},
	};
}

function requireNonEmptyQuery(value: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) {
		throw new Error("query must not be empty.");
	}
	return normalized;
}

function normalizeUrls(values: string[]): string[] {
	if (values.length === 0) {
		throw new Error("urls must include at least one URL.");
	}
	if (values.length > MAX_FETCH_URLS) {
		throw new Error(`urls may contain at most ${MAX_FETCH_URLS} entries.`);
	}
	return dedupe(values.map(normalizeUrl));
}

function normalizeUrl(value: string): string {
	const raw = value.trim();
	if (raw.length === 0) {
		throw new Error("urls must not contain empty entries.");
	}
	const parsed = new URL(raw);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`Unsupported URL protocol for ${raw}. Use http or https.`);
	}
	parsed.hash = "";
	return parsed.toString();
}

function normalizeDomainFilters(values: string[] | undefined): string[] {
	const normalized = normalizeStringList(values).map(normalizeDomainFilter);
	if (normalized.length > MAX_INCLUDE_DOMAINS) {
		throw new Error(`includeDomains may contain at most ${MAX_INCLUDE_DOMAINS} entries.`);
	}
	return dedupe(normalized);
}

function normalizeDomainFilter(value: string): string {
	if (value.includes("://")) {
		const parsed = new URL(value);
		const pathname = parsed.pathname.replace(/\/+$/, "");
		return `${parsed.hostname.toLowerCase()}${pathname}`;
	}
	return value.trim().toLowerCase().replace(/\/+$/, "");
}

function normalizeStringList(values: string[] | undefined): string[] {
	if (!values) {
		return [];
	}
	return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function dedupe(values: string[]): string[] {
	return [...new Set(values)];
}
