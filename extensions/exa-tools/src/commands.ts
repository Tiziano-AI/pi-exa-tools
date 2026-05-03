import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getMissingApiKeyMessage, readExaAuthState } from "./config.ts";
import { requireUi, showText, runWithStatus } from "./command-ui.ts";
import { runAuthEditor, runFetch, runSearch } from "./manual-actions.ts";
import { parseExaCommandInput, type ExaAction } from "./operator-helpers.ts";
import { runHealthCheck } from "./operations.ts";
import { resolveProjectRoot } from "./project.ts";
import { formatPreviewSettingsHint, formatPreviewSettingsLabel } from "./preview-limits.ts";
import { renderStatusReport, type HealthStatus } from "./reports.ts";
import {
	loadOperatorConfig,
	loadScopedOperatorConfig,
	resetOperatorConfig,
	saveOperatorConfig,
	type ConfigScope,
} from "./settings.ts";

function parseScope(args: string | undefined): ConfigScope {
	return args?.trim().toLowerCase() === "global" ? "global" : "project";
}

async function runStatus(pi: ExtensionAPI, ctx: ExtensionCommandContext, checkHealth: boolean): Promise<void> {
	const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
	const config = loadOperatorConfig(projectRoot);
	const authState = readExaAuthState();
	const authConfig = authState.config;
	let health: HealthStatus = { kind: "not-run" };
	if (checkHealth) {
		if (!authConfig) {
			health = { kind: "fail", message: getMissingApiKeyMessage() };
		} else {
			try {
				const result = await runWithStatus(ctx, "Checking Exa health...", () => runHealthCheck(authConfig, AbortSignal.timeout(8000)));
				health = { kind: "pass", message: `${result.resultCount} result(s) returned` };
			} catch (error) {
				health = { kind: "fail", message: error instanceof Error ? error.message : String(error) };
			}
		}
	}
	await showText(ctx, checkHealth ? "exa health" : "exa status", renderStatusReport(projectRoot, authState, config, health));
}

async function runSettingsDialog(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string | undefined): Promise<void> {
	if (!(await requireUi(ctx, "Exa settings"))) return;
	const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
	let scope = parseScope(args);
	let config = loadScopedOperatorConfig(scope, projectRoot);
	while (true) {
		const selected = await ctx.ui.select("Exa settings", [
			`scope: ${scope}`,
			`enabled: ${config.enabled ? "yes" : "no"}`,
			formatPreviewSettingsLabel(),
			`reset ${scope} config`,
			"done",
		]);
		if (!selected || selected === "done") return;
		if (selected.startsWith("scope:")) {
			scope = scope === "project" ? "global" : "project";
			config = loadScopedOperatorConfig(scope, projectRoot);
			ctx.ui.notify(`Editing ${scope} Exa settings`, "info");
			continue;
		}
		if (selected.startsWith("enabled:")) {
			config = { enabled: !config.enabled };
			await saveOperatorConfig(scope, projectRoot, config);
			continue;
		}
		if (selected.startsWith("output preview:")) {
			ctx.ui.notify(formatPreviewSettingsHint(), "info");
			continue;
		}
		if (selected === `reset ${scope} config`) {
			const confirmed = await ctx.ui.confirm("Reset Exa settings", `Delete the ${scope} Exa config file?`);
			if (confirmed) {
				await resetOperatorConfig(scope, projectRoot);
				config = loadScopedOperatorConfig(scope, projectRoot);
				ctx.ui.notify(`Reset ${scope} Exa config`, "info");
			}
		}
	}
}

async function runReset(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string | undefined): Promise<void> {
	if (!(await requireUi(ctx, "Exa reset"))) return;
	const projectRoot = await resolveProjectRoot(pi, ctx.cwd);
	const scope = parseScope(args);
	const confirmed = await ctx.ui.confirm("Reset Exa settings", `Delete the ${scope} Exa config file?`);
	if (!confirmed) return;
	await resetOperatorConfig(scope, projectRoot);
	ctx.ui.notify(`Reset ${scope} Exa config`, "info");
}

async function pickAction(ctx: ExtensionCommandContext): Promise<ExaAction | undefined> {
	if (!(await requireUi(ctx, "Exa operator"))) return undefined;
	const selected = await ctx.ui.select("Exa", ["status", "check", "search", "fetch", "auth", "settings", "reset", "done"]);
	if (!selected || selected === "done") return undefined;
	const parsed = parseExaCommandInput(selected);
	return parsed.action;
}

/** Run the canonical Exa operator command. */
export async function runExaCommand(pi: ExtensionAPI, ctx: ExtensionCommandContext, args: string | undefined): Promise<void> {
	const parsed = parseExaCommandInput(args);
	if (!parsed.action && parsed.remainder.length > 0) {
		ctx.ui.notify(`Unknown /exa action: ${parsed.remainder}. Use /exa and pick an action.`, "warning");
		return;
	}
	const action = parsed.action ?? (await pickAction(ctx));
	if (!action) return;
	if (action === "status") {
		await runStatus(pi, ctx, parsed.remainder === "check");
		return;
	}
	if (action === "check") {
		await runStatus(pi, ctx, true);
		return;
	}
	if (action === "search") {
		await runSearch(pi, ctx, parsed.remainder);
		return;
	}
	if (action === "fetch") {
		await runFetch(pi, ctx, parsed.remainder);
		return;
	}
	if (action === "auth") {
		await runAuthEditor(ctx);
		return;
	}
	if (action === "settings") {
		await runSettingsDialog(pi, ctx, parsed.remainder);
		return;
	}
	await runReset(pi, ctx, parsed.remainder);
}
