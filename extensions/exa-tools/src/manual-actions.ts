import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getAuthFileTemplate, getMissingApiKeyMessage, readExaAuthState, removeAuthFile, writeAuthFile } from "./config.ts";
import { formatErrorMessage, parseListInput, requireUi, showText, runWithStatus } from "./command-ui.ts";
import { runFetchRequest, runSearchRequest } from "./operations.ts";
import { buildFetchCommandFromUrls } from "./operator-helpers.ts";
import { resolveProjectRoot } from "./project.ts";
import { renderFetchReport, renderSearchReport } from "./reports.ts";
import { loadOperatorConfig, type ExaOperatorConfig } from "./settings.ts";

interface SearchDraft {
	query: string;
	includeDomains: string[];
}

interface FetchDraft {
	urls: string[];
}

function createSearchDraft(query: string): SearchDraft {
	return {
		query,
		includeDomains: [],
	};
}

function createFetchDraft(urls: string[]): FetchDraft {
	return { urls };
}

function ensureEnabled(config: ExaOperatorConfig): string | undefined {
	return config.enabled ? undefined : "pi-exa-tools is disabled. Re-enable it in /exa settings.";
}

async function ensureAuth(ctx: ExtensionCommandContext): Promise<ReturnType<typeof readExaAuthState> | undefined> {
	const authState = readExaAuthState();
	if (authState.config) {
		return authState;
	}
	if (!(await requireUi(ctx, "Exa auth"))) {
		return undefined;
	}
	const shouldEdit = await ctx.ui.confirm("Exa auth missing", `${getMissingApiKeyMessage()}\n\nOpen the Exa auth file now?`);
	if (shouldEdit) {
		await runAuthEditor(ctx);
	}
	return undefined;
}

/** Runs the Exa auth editor and writes only the stable Pi user auth file. */
export async function runAuthEditor(ctx: ExtensionCommandContext): Promise<void> {
	if (!(await requireUi(ctx, "Exa auth"))) return;
	const authState = readExaAuthState();
	const edited = await ctx.ui.editor("Exa auth", authState.authFileText ?? getAuthFileTemplate());
	if (edited === undefined) return;
	if (edited.trim().length === 0) {
		const confirmed = await ctx.ui.confirm("Remove Exa auth file", "Delete the Exa auth file?");
		if (!confirmed) return;
		await removeAuthFile();
		ctx.ui.notify("Removed the Exa auth file.", "info");
		return;
	}
	await writeAuthFile(edited);
	ctx.ui.notify(
		authState.apiKeySource === "env"
			? "Saved the Exa auth file. Shell environment values still take precedence."
			: "Saved the Exa auth file.",
		"info",
	);
}

async function editSearchDraft(ctx: ExtensionCommandContext, draft: SearchDraft): Promise<SearchDraft | undefined> {
	while (true) {
		const selected = await ctx.ui.select("Exa search", [
			`query: ${draft.query || "(required)"}`,
			`include domains: ${draft.includeDomains.length > 0 ? draft.includeDomains.join(", ") : "(none)"}`,
			"run search",
			"cancel",
		]);
		if (!selected || selected === "cancel") return undefined;
		if (selected.startsWith("query:")) {
			const next = await ctx.ui.input("Search query", draft.query || "what do you want to search?");
			if (next !== undefined) draft = { ...draft, query: next.trim() };
			continue;
		}
		if (selected.startsWith("include domains:")) {
			const next = await ctx.ui.editor("Include domains", draft.includeDomains.join("\n"));
			if (next !== undefined) draft = { ...draft, includeDomains: parseListInput(next) };
			continue;
		}
		if (selected === "run search") {
			if (draft.query.length === 0) {
				ctx.ui.notify("Search query is required.", "warning");
				continue;
			}
			return draft;
		}
	}
}

/** Runs the manual `/exa search` wizard and optional follow-up fetch prefill. */
export async function runSearch(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string | undefined): Promise<void> {
	if (!(await requireUi(ctx, "Exa search"))) return;
	const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
	const config = loadOperatorConfig(projectRoot);
	const disabledMessage = ensureEnabled(config);
	if (disabledMessage) {
		ctx.ui.notify(disabledMessage, "warning");
		return;
	}
	const authState = await ensureAuth(ctx);
	const authConfig = authState?.config;
	if (!authConfig) return;
	const draft = await editSearchDraft(ctx, createSearchDraft(args?.trim() ?? ""));
	if (!draft) return;
	try {
		const result = await runWithStatus(ctx, `Searching Exa for \"${draft.query}\"...`, () => runSearchRequest(authConfig, {
			query: draft.query,
			includeDomains: draft.includeDomains,
		}));
		await showText(ctx, "exa search", renderSearchReport(result.details, result.outputText));
		const suggested = buildFetchCommandFromUrls(result.details.items.slice(0, 3).map((item) => item.url));
		if (suggested) {
			const shouldPrefill = await ctx.ui.confirm("Prefill follow-up fetch", `Paste a ready-to-edit fetch command for the top results into the composer?\n\n${suggested}`);
			if (shouldPrefill) {
				ctx.ui.setEditorText(suggested);
			}
		}
	} catch (error) {
		ctx.ui.notify(`Exa search failed: ${formatErrorMessage(error)}`, "error");
	}
}

async function editFetchDraft(ctx: ExtensionCommandContext, draft: FetchDraft): Promise<FetchDraft | undefined> {
	while (true) {
		const selected = await ctx.ui.select("Exa fetch", [
			`urls: ${draft.urls.length > 0 ? `${draft.urls.length} entered` : "(required)"}`,
			"run fetch",
			"cancel",
		]);
		if (!selected || selected === "cancel") return undefined;
		if (selected.startsWith("urls:")) {
			const next = await ctx.ui.editor("Fetch URLs", draft.urls.join("\n"));
			if (next !== undefined) draft = { ...draft, urls: parseListInput(next) };
			continue;
		}
		if (selected === "run fetch") {
			if (draft.urls.length === 0) {
				ctx.ui.notify("At least one URL is required.", "warning");
				continue;
			}
			return draft;
		}
	}
}

/** Runs the manual `/exa fetch` wizard for explicit URL text extraction. */
export async function runFetch(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string | undefined): Promise<void> {
	if (!(await requireUi(ctx, "Exa fetch"))) return;
	const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
	const config = loadOperatorConfig(projectRoot);
	const disabledMessage = ensureEnabled(config);
	if (disabledMessage) {
		ctx.ui.notify(disabledMessage, "warning");
		return;
	}
	const authState = await ensureAuth(ctx);
	const authConfig = authState?.config;
	if (!authConfig) return;
	const initialUrls = args?.trim() ? parseListInput(args) : [];
	const draft = await editFetchDraft(ctx, createFetchDraft(initialUrls));
	if (!draft) return;
	try {
		const result = await runWithStatus(ctx, `Fetching ${draft.urls.length} URL(s) via Exa...`, () => runFetchRequest(authConfig, {
			urls: draft.urls,
		}));
		await showText(ctx, "exa fetch", renderFetchReport(result.details, result.outputText));
	} catch (error) {
		ctx.ui.notify(`Exa fetch failed: ${formatErrorMessage(error)}`, "error");
	}
}
