/** Minimal Exa API request and response shapes used by the Pi extension. */

/** Text extraction options sent to Exa `/contents`. */
export interface ExaTextOptions {
	maxCharacters?: number;
}

/** Highlight extraction options sent to Exa `/search`. */
export interface ExaHighlightsOptions {
	maxCharacters?: number;
}

/** Search content request shape; this package only requests highlights. */
export interface ExaSearchContents {
	highlights: ExaHighlightsOptions;
}

/** Canonical Exa `/search` request shape emitted by the mapper. */
export interface ExaSearchRequest {
	query: string;
	type: "auto";
	numResults: number;
	includeDomains?: string[];
	contents?: ExaSearchContents;
}

/** Canonical Exa `/contents` request shape emitted by the mapper. */
export interface ExaContentsRequest {
	urls: string[];
	text: ExaTextOptions;
}

/** Exa cost envelope when returned by the API. */
export interface ExaCostDollars {
	total?: number;
}

/** Result item fields consumed by formatters. */
export interface ExaSearchResult {
	title?: string;
	url: string;
	id?: string;
	publishedDate?: string | null;
	text?: string;
	highlights?: string[];
}

/** Exa `/search` response fields consumed by the package. */
export interface ExaSearchResponse {
	requestId?: string;
	searchType?: string;
	results?: ExaSearchResult[];
	costDollars?: ExaCostDollars;
}

/** Per-URL Exa extraction error metadata. */
export interface ExaStatusError {
	tag?: string;
	httpStatusCode?: number | null;
}

/** Per-URL Exa extraction status. */
export interface ExaContentsStatus {
	id: string;
	status: "success" | "error";
	error?: ExaStatusError;
}

/** Exa `/contents` response fields consumed by the package. */
export interface ExaContentsResponse {
	requestId?: string;
	results?: ExaSearchResult[];
	statuses?: ExaContentsStatus[];
	costDollars?: ExaCostDollars;
}

/** Exa error envelope returned for failed HTTP requests. */
export interface ExaErrorBody {
	requestId?: string;
	error?: string;
	tag?: string;
}
