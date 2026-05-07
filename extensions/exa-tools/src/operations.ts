import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	formatSize,
	truncateHead,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { ExaClient } from "./exa-client.ts";
import { formatContentsResponse, formatSearchResponse } from "./format.ts";
import { mapFetchInput, mapSearchInput } from "./mappers.ts";
import { resolvePreviewLimits, toTruncationOptions } from "./preview-limits.ts";
import type { ExaConfig } from "./config.ts";
import type { ExaFetchInput, ExaSearchInput, FetchToolDetails, SearchToolDetails, StoredTruncation } from "./tool-types.ts";

/** Final tool output and details after formatting and truncation. */
export interface FinalizedExaResult<TDetails extends { truncation?: StoredTruncation; fullOutputPath?: string }> {
	outputText: string;
	details: TDetails;
}

const client = new ExaClient();

/** Executes the canonical Exa search request and formats model-facing evidence text. */
export async function runSearchRequest(
	config: ExaConfig,
	input: ExaSearchInput,
	signal?: AbortSignal,
): Promise<FinalizedExaResult<SearchToolDetails>> {
	const { payload, normalized } = mapSearchInput(input);
	const response = await client.search(config, payload, signal);
	const formatted = formatSearchResponse(response, normalized);
	return finalizeResult(formatted.text, formatted.details);
}

/** Executes the canonical Exa contents request and formats model-facing evidence text. */
export async function runFetchRequest(
	config: ExaConfig,
	input: ExaFetchInput,
	signal?: AbortSignal,
): Promise<FinalizedExaResult<FetchToolDetails>> {
	const { payload, normalized } = mapFetchInput(input);
	const response = await client.contents(config, payload, signal);
	const formatted = formatContentsResponse(response, normalized);
	return finalizeResult(formatted.text, formatted.details);
}

/** Performs a small Exa search request for operator health checks. */
export async function runHealthCheck(config: ExaConfig, signal: AbortSignal): Promise<{ resultCount: number }> {
	const response = await client.search(
		config,
		{
			query: "Exa official site",
			type: "auto",
			numResults: 1,
			includeDomains: ["exa.ai"],
		},
		signal,
	);
	return { resultCount: response.results?.length ?? 0 };
}

async function finalizeResult<TDetails extends { truncation?: StoredTruncation; fullOutputPath?: string }>(
	text: string,
	details: TDetails,
): Promise<FinalizedExaResult<TDetails>> {
	const limits = resolvePreviewLimits();
	const truncation = truncateHead(text, toTruncationOptions(limits));
	let outputText = truncation.content;
	if (truncation.truncated) {
		const tempDir = await mkdtemp(join(tmpdir(), "pi-exa-"));
		const fullOutputPath = join(tempDir, "output.txt");
		await withFileMutationQueue(fullOutputPath, async () => {
			await writeFile(fullOutputPath, text, "utf8");
		});
		details.truncation = {
			outputLines: truncation.outputLines,
			totalLines: truncation.totalLines,
			outputBytes: truncation.outputBytes,
			totalBytes: truncation.totalBytes,
			truncatedBy: normalizeTruncatedBy(truncation.truncatedBy),
			maxLines: limits.lines.value,
			maxBytes: limits.bytes.value,
		};
		details.fullOutputPath = fullOutputPath;
		const preview = outputText.length > 0 ? outputText : "[No complete line fit in the configured Exa output preview.]";
		outputText = preview;
		outputText += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
		outputText += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
		outputText += ` Full output saved to: ${fullOutputPath}. Use the read tool on that path if you need omitted content.]`;
	}
	return { outputText, details };
}

function normalizeTruncatedBy(value: string | null): "lines" | "bytes" {
	return value === "lines" ? "lines" : "bytes";
}
