/** Tool-facing parameter and result types. */

/** Model-callable search input; maps to fixed Exa search defaults plus optional source filters. */
export interface ExaSearchInput {
	query: string;
	includeDomains?: string[];
}

/** Model-callable fetch input; maps explicit URLs to fixed Exa text extraction. */
export interface ExaFetchInput {
	urls: string[];
}

/** Output truncation metadata stored in tool details for TUI recovery. */
export interface StoredTruncation {
	outputLines: number;
	totalLines: number;
	outputBytes: number;
	totalBytes: number;
}

/** Compact search result item stored for expanded TUI rendering. */
export interface SearchSummaryItem {
	index: number;
	title: string;
	url: string;
	domain: string;
	publishedDate?: string | null;
	snippetPreview: string;
}

/** Search tool details stored outside model-facing content for rendering and state. */
export interface SearchToolDetails {
	kind: "search";
	query: string;
	searchType: string;
	resultCount: number;
	returnedResults: number;
	includeDomains: string[];
	requestId?: string;
	costTotal?: number;
	items: SearchSummaryItem[];
	truncation?: StoredTruncation;
	fullOutputPath?: string;
}

/** Compact fetch result item stored for expanded TUI rendering. */
export interface FetchSummaryItem {
	url: string;
	status: "success" | "error";
	title?: string;
	preview: string;
	errorTag?: string;
	httpStatusCode?: number | null;
}

/** Fetch tool details stored outside model-facing content for rendering and state. */
export interface FetchToolDetails {
	kind: "fetch";
	requestId?: string;
	costTotal?: number;
	requestedUrls: string[];
	successCount: number;
	errorCount: number;
	items: FetchSummaryItem[];
	truncation?: StoredTruncation;
	fullOutputPath?: string;
}

/** Normalized search request values shared by mappers and formatters. */
export interface SearchMappingResult {
	query: string;
	resultCount: number;
	includeDomains: string[];
	maxCharacters: number;
}

/** Normalized fetch request values shared by mappers and formatters. */
export interface FetchMappingResult {
	urls: string[];
	maxCharacters: number;
}
