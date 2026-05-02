/** Tool-facing text formatting and compact persisted details. */

import type { ExaContentsResponse, ExaContentsStatus, ExaSearchResponse, ExaSearchResult } from "./api-types.ts";
import type { FetchMappingResult, FetchToolDetails, SearchMappingResult, SearchToolDetails } from "./tool-types.ts";

const DETAIL_PREVIEW_LENGTH = 220;

/** Formats an Exa search response for Pi tool output and compact session details. */
export function formatSearchResponse(response: ExaSearchResponse, normalized: SearchMappingResult): {
	text: string;
	details: SearchToolDetails;
} {
	const results = response.results ?? [];
	const searchType = response.searchType ?? "auto";
	const items = results.map((result, index) => ({
		index: index + 1,
		title: result.title?.trim() || result.url,
		url: result.url,
		domain: getDomain(result.url),
		publishedDate: result.publishedDate ?? undefined,
		snippetPreview: createSearchPreview(result),
	}));

	let text = `Exa search for "${normalized.query}" returned ${results.length} result(s).`;
	if (results.length === 0) {
		return {
			text,
			details: {
				kind: "search",
				query: normalized.query,
				searchType,
				resultCount: normalized.resultCount,
				returnedResults: 0,
				includeDomains: normalized.includeDomains,
				requestId: response.requestId,
				costTotal: response.costDollars?.total,
				items: [],
			},
		};
	}

	for (const item of items) {
		text += `\n\n${item.index}. ${item.title}`;
		text += `\nURL: ${item.url}`;
		if (item.publishedDate) {
			text += `\nPublished: ${item.publishedDate}`;
		}
		const fullResult = results[item.index - 1];
		text += `\n${renderSearchHighlights(fullResult)}`;
	}

	return {
		text,
		details: {
			kind: "search",
			query: normalized.query,
			searchType,
			resultCount: normalized.resultCount,
			returnedResults: results.length,
			includeDomains: normalized.includeDomains,
			requestId: response.requestId,
			costTotal: response.costDollars?.total,
			items,
		},
	};
}

/** Formats an Exa contents response for Pi tool output and compact session details. */
export function formatContentsResponse(response: ExaContentsResponse, normalized: FetchMappingResult): {
	text: string;
	details: FetchToolDetails;
} {
	const statusMap = buildStatusMap(response.statuses ?? []);
	const resultMap = buildResultMap(response.results ?? []);
	const items = normalized.urls.map((url) => {
		const canonicalUrl = canonicalizeUrlKey(url);
		return buildFetchSummary(url, statusMap.get(url) ?? statusMap.get(canonicalUrl), resultMap.get(url) ?? resultMap.get(canonicalUrl));
	});
	const successCount = items.filter((item) => item.status === "success").length;
	const errorCount = items.length - successCount;

	let text = `Exa fetch processed ${items.length} URL(s): ${successCount} success, ${errorCount} error.`;
	for (const item of items) {
		text += `\n\nURL: ${item.url}`;
		text += `\nStatus: ${item.status}`;
		if (item.title) {
			text += `\nTitle: ${item.title}`;
		}
		if (item.errorTag) {
			text += `\nError: ${item.errorTag}`;
			if (item.httpStatusCode) {
				text += ` (HTTP ${item.httpStatusCode})`;
			}
		}
		if (item.preview.length > 0) {
			text += `\nText:\n${item.preview}`;
		}
	}

	return {
		text,
		details: {
			kind: "fetch",
			requestId: response.requestId,
			costTotal: response.costDollars?.total,
			requestedUrls: normalized.urls,
			successCount,
			errorCount,
			items,
		},
	};
}

function buildStatusMap(statuses: ExaContentsStatus[]): Map<string, ExaContentsStatus> {
	const map = new Map<string, ExaContentsStatus>();
	for (const status of statuses) {
		map.set(status.id, status);
		map.set(canonicalizeUrlKey(status.id), status);
	}
	return map;
}

function buildResultMap(results: ExaSearchResult[]): Map<string, ExaSearchResult> {
	const map = new Map<string, ExaSearchResult>();
	for (const result of results) {
		map.set(result.url, result);
		map.set(canonicalizeUrlKey(result.url), result);
		if (result.id) {
			map.set(result.id, result);
			map.set(canonicalizeUrlKey(result.id), result);
		}
	}
	return map;
}

function buildFetchSummary(
	url: string,
	status: ExaContentsStatus | undefined,
	result: ExaSearchResult | undefined,
): FetchToolDetails["items"][number] {
	if (status?.status === "error") {
		return {
			url,
			status: "error",
			preview: "",
			errorTag: status.error?.tag,
			httpStatusCode: status.error?.httpStatusCode,
		};
	}

	if (!result) {
		return {
			url,
			status: "error",
			preview: "No extracted content returned.",
			errorTag: "NO_CONTENT_RETURNED",
			httpStatusCode: undefined,
		};
	}

	return {
		url,
		status: "success",
		title: result.title?.trim() || undefined,
		preview: result.text?.trim() || "No text returned.",
	};
}

function renderSearchHighlights(result: ExaSearchResult): string {
	const highlights = result.highlights ?? [];
	if (highlights.length === 0) {
		return "Highlights: none returned.";
	}
	return `Highlights:\n${highlights.map((value) => `- ${value}`).join("\n")}`;
}

function createSearchPreview(result: ExaSearchResult): string {
	const highlights = result.highlights ?? [];
	if (highlights.length === 0) {
		return "No highlights returned.";
	}
	return collapseWhitespace(highlights.join(" ")).slice(0, DETAIL_PREVIEW_LENGTH);
}

function getDomain(url: string): string {
	return new URL(url).hostname;
}

function canonicalizeUrlKey(value: string): string {
	const parsed = new URL(value);
	parsed.hash = "";
	if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
		parsed.pathname = parsed.pathname.replace(/\/+$/, "");
	}
	return parsed.toString();
}

function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
