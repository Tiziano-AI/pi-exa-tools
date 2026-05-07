/** Pi extension entrypoint for direct Exa-backed search, fetch, and operator workflows. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { readExaAuthState, getMissingApiKeyMessage } from "./src/config.ts";
import { runExaCommand } from "./src/commands.ts";
import { runFetchRequest, runSearchRequest } from "./src/operations.ts";
import { resolveProjectRoot } from "./src/project.ts";
import { formatPreviewToolSentence } from "./src/preview-limits.ts";
import {
	applyFetchDefaults,
	applySearchDefaults,
	loadOperatorConfig,
} from "./src/settings.ts";
import { ExaFetchSchema, ExaSearchSchema } from "./src/schemas.ts";
import type { FetchToolDetails, SearchToolDetails } from "./src/tool-types.ts";

/** Registers the Exa-backed Pi tools and operator command. */
export default function exaToolsExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "exa_search",
		label: "Exa Search",
		description: `Search the live web through Exa. Returns 10 ranked results with concise highlights. ${formatPreviewToolSentence()}`,
		promptSnippet: "Search the live web through Exa for source discovery before deeper fetching.",
		promptGuidelines: [
			"Use exa_search when the task depends on changing web facts, official documentation, or external examples outside the workspace.",
			"Use includeDomains with exa_search when official or trusted sources matter.",
			"Use exa_fetch on promising URLs instead of asking exa_search for long text.",
			"When a result says full output was saved to a temp file, use read on that path only if the omitted evidence is needed.",
		],
		parameters: ExaSearchSchema,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
			const operatorConfig = loadOperatorConfig(projectRoot);
			if (!operatorConfig.enabled) {
				throw new Error("pi-exa-tools is disabled. Re-enable it in /exa settings.");
			}
			const authState = readExaAuthState();
			const authConfig = authState.config;
			if (!authConfig) {
				throw new Error(getMissingApiKeyMessage());
			}
			const result = await runSearchRequest(authConfig, applySearchDefaults(params, operatorConfig), signal);
			return {
				content: [{ type: "text", text: result.outputText }],
				details: result.details,
			};
		},
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("exa_search "));
			text += theme.fg("accent", `"${args.query}"`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Searching Exa..."), 0, 0);
			}
			const details = isSearchToolDetails(result.details) ? result.details : undefined;
			if (!details) {
				return new Text(extractPrimaryText(result.content), 0, 0);
			}
			let text = theme.fg("success", `${details.returnedResults} result(s)`);
			if (details.costTotal !== undefined) {
				text += theme.fg("dim", ` cost ${formatCurrency(details.costTotal)}`);
			}
			text += theme.fg("muted", ` via ${details.searchType}`);
			if (details.truncation) {
				text += theme.fg("warning", " truncated");
			}
			if (expanded) {
				for (const item of details.items) {
					text += `\n${theme.fg("accent", `${item.index}.`)} ${theme.fg("toolTitle", item.title)}`;
					text += `\n${theme.fg("dim", item.url)}`;
					if (item.snippetPreview.length > 0) {
						text += `\n${theme.fg("muted", item.snippetPreview)}`;
					}
				}
				if (details.fullOutputPath) {
					text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
				}
			}
			return new Text(text, 0, 0);
		},
	});

	pi.registerTool({
		name: "exa_fetch",
		label: "Exa Fetch",
		description: `Fetch clean page text from one or more explicit URLs through Exa /contents. Always reports per-URL failures. ${formatPreviewToolSentence()}`,
		promptSnippet: "Fetch clean page text from explicit URLs via Exa after search has identified promising sources.",
		promptGuidelines: [
			"Use exa_fetch after exa_search when you need deeper page content from selected URLs.",
			"Do not fetch every result blindly. Pick the most relevant URLs first.",
			"When a result says full output was saved to a temp file, use read on that path only if the omitted evidence is needed.",
		],
		parameters: ExaFetchSchema,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
			const operatorConfig = loadOperatorConfig(projectRoot);
			if (!operatorConfig.enabled) {
				throw new Error("pi-exa-tools is disabled. Re-enable it in /exa settings.");
			}
			const authState = readExaAuthState();
			const authConfig = authState.config;
			if (!authConfig) {
				throw new Error(getMissingApiKeyMessage());
			}
			const result = await runFetchRequest(authConfig, applyFetchDefaults(params, operatorConfig), signal);
			return {
				content: [{ type: "text", text: result.outputText }],
				details: result.details,
			};
		},
		renderCall(args, theme) {
			const count = Array.isArray(args.urls) ? args.urls.length : 0;
			let text = theme.fg("toolTitle", theme.bold("exa_fetch "));
			text += theme.fg("accent", `${count} url(s)`);
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) {
				return new Text(theme.fg("warning", "Fetching via Exa..."), 0, 0);
			}
			const details = isFetchToolDetails(result.details) ? result.details : undefined;
			if (!details) {
				return new Text(extractPrimaryText(result.content), 0, 0);
			}
			let text = theme.fg("success", `${details.successCount} success`);
			text += theme.fg("muted", ` ${details.errorCount} error`);
			if (details.costTotal !== undefined) {
				text += theme.fg("dim", ` cost ${formatCurrency(details.costTotal)}`);
			}
			if (details.truncation) {
				text += theme.fg("warning", " truncated");
			}
			if (expanded) {
				for (const item of details.items) {
					const statusColor = item.status === "success" ? "success" : "error";
					text += `\n${theme.fg(statusColor, `[${item.status}]`)} ${theme.fg("accent", item.url)}`;
					if (item.title) {
						text += `\n${theme.fg("toolTitle", item.title)}`;
					}
					if (item.errorTag) {
						text += `\n${theme.fg("error", item.errorTag)}`;
					}
					if (item.preview.length > 0) {
						text += `\n${theme.fg("muted", item.preview)}`;
					}
				}
				if (details.fullOutputPath) {
					text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
				}
			}
			return new Text(text, 0, 0);
		},
	});

	pi.registerCommand("exa", {
		description: "Open the Exa operator console. Supports status, check, search, fetch, auth, settings, and reset.",
		handler: async (args, ctx) => {
			await runExaCommand(pi, ctx, args);
		},
	});
}

function extractPrimaryText(content: unknown): string {
	if (!Array.isArray(content)) {
		return "";
	}
	for (const item of content) {
		if (isRecord(item) && item.type === "text" && typeof item.text === "string") {
			return item.text;
		}
	}
	return "";
}

function isSearchToolDetails(value: unknown): value is SearchToolDetails {
	return isRecord(value) && value.kind === "search" && typeof value.query === "string" && Array.isArray(value.items);
}

function isFetchToolDetails(value: unknown): value is FetchToolDetails {
	return isRecord(value) && value.kind === "fetch" && Array.isArray(value.items) && Array.isArray(value.requestedUrls);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function formatCurrency(amount: number): string {
	return `$${amount.toFixed(4)}`;
}
