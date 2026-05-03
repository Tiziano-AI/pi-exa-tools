import { existsSync } from "node:fs";
import type { ExaAuthState } from "./config.ts";
import {
	formatHardLimitSummary,
	formatPreviewLimitOriginLines,
	formatPreviewLimitSummary,
	resolvePreviewLimits,
	PREVIEW_BYTES_ENV,
	PREVIEW_LINES_ENV,
} from "./preview-limits.ts";
import { getGlobalConfigPath, getProjectConfigPath, type ExaOperatorConfig } from "./settings.ts";
import type { FetchToolDetails, SearchToolDetails } from "./tool-types.ts";

/** Health-check state rendered in the operator status report. */
export interface HealthStatus {
	kind: "not-run" | "pass" | "fail";
	message?: string;
}

/** Renders the `/exa status` report for TUI/editor display. */
export function renderStatusReport(projectRoot: string, authState: ExaAuthState, config: ExaOperatorConfig, health: HealthStatus): string {
	const previewLimits = resolvePreviewLimits();
	const lines = [
		"# Exa Operator Status",
		"",
		"## Runtime",
		`- Enabled: ${config.enabled ? "yes" : "no"}`,
		`- Project root: ${projectRoot}`,
		`- Global config: ${describePath(getGlobalConfigPath())}`,
		`- Project config: ${describePath(getProjectConfigPath(projectRoot))}`,
		"",
		"## Auth",
		`- API key: ${describeApiKeySource(authState.apiKeySource)}`,
		`- Base URL: ${authState.config?.baseUrl ?? "unavailable"} (${describeBaseUrlSource(authState.baseUrlSource)})`,
		`- Auth file: ${describePath(authState.authFilePath)}`,
		`- Shell environment overrides auth file: yes`,
		"",
		"## Research contract",
		"- Search: Exa /search, type=auto, 10 results, highlights only",
		"- Fetch: Exa /contents, clean text only, one to seven explicit URLs",
		`- Output preview: first ${formatPreviewLimitSummary(previewLimits)}; full output saved to temp file when truncated`,
		"- Cost: shown in TUI/details when Exa returns it; omitted from model-facing text",
		"- Not exposed: focus, freshness, speed, summaries, subpages, deep search, answer generation",
		"",
		"## Output preview",
		`- Hard cap: ${formatHardLimitSummary()}`,
		`- Lower-only env: ${PREVIEW_LINES_ENV}, ${PREVIEW_BYTES_ENV}`,
		"- Follow-up: when a result includes a full-output path, use read on that path only if omitted evidence is needed",
		...formatPreviewLimitOriginLines(previewLimits),
		"",
		"## Health check",
		renderHealthLine(health),
		"",
		"## Commands",
		"- /exa",
		"- /exa status",
		"- /exa check",
		"- /exa search <query>",
		"- /exa fetch <urls>",
		"- /exa auth",
		"- /exa settings [global|project]",
		"- /exa reset [global|project]",
	];
	return `${lines.join("\n")}\n`;
}

/** Renders a manual search report with cost metadata kept outside model tool text. */
export function renderSearchReport(details: SearchToolDetails, outputText: string): string {
	const suggestedFetch = details.items.length > 0
		? `/exa fetch ${details.items.slice(0, 3).map((item) => item.url).join(" ")}`
		: undefined;
	const lines = [
		"# Exa Search",
		"",
		`- Query: ${details.query}`,
		`- Search type: ${details.searchType}`,
		`- Requested results: ${details.resultCount}`,
		`- Returned results: ${details.returnedResults}`,
		`- Include domains: ${renderList(details.includeDomains)}`,
		details.requestId ? `- Request ID: ${details.requestId}` : undefined,
		details.costTotal !== undefined ? `- Cost: $${details.costTotal.toFixed(4)}` : undefined,
		details.fullOutputPath ? `- Full output: ${details.fullOutputPath}` : undefined,
		"",
		"## Results",
		outputText,
		suggestedFetch ? "" : undefined,
		suggestedFetch ? "## Suggested next step" : undefined,
		suggestedFetch,
	].filter((line): line is string => line !== undefined);
	return `${lines.join("\n")}\n`;
}

/** Renders a manual fetch report with per-URL status and cost metadata. */
export function renderFetchReport(details: FetchToolDetails, outputText: string): string {
	const lines = [
		"# Exa Fetch",
		"",
		`- Requested URLs: ${details.requestedUrls.length}`,
		`- Success: ${details.successCount}`,
		`- Error: ${details.errorCount}`,
		details.requestId ? `- Request ID: ${details.requestId}` : undefined,
		details.costTotal !== undefined ? `- Cost: $${details.costTotal.toFixed(4)}` : undefined,
		details.fullOutputPath ? `- Full output: ${details.fullOutputPath}` : undefined,
		"",
		"## Results",
		outputText,
	].filter((line): line is string => line !== undefined);
	return `${lines.join("\n")}\n`;
}

function renderHealthLine(health: HealthStatus): string {
	if (health.kind === "not-run") {
		return "- Not run";
	}
	if (health.kind === "pass") {
		return `- Pass: ${health.message ?? "ok"}`;
	}
	return `- Fail: ${health.message ?? "unknown error"}`;
}

function describeApiKeySource(source: ExaAuthState["apiKeySource"]): string {
	if (source === "env") return "present via shell env";
	if (source === "auth-file") return "present via auth file";
	return "missing";
}

function describeBaseUrlSource(source: ExaAuthState["baseUrlSource"]): string {
	if (source === "env") return "shell env";
	if (source === "auth-file") return "auth file";
	return "default";
}

function describePath(path: string): string {
	return `${path}${existsSync(path) ? "" : " (missing)"}`;
}

function renderList(values: string[]): string {
	return values.length > 0 ? values.join(", ") : "(none)";
}
