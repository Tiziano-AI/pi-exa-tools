import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

/** Ensure the Exa operator flow is running with an interactive UI surface. */
export async function requireUi(ctx: ExtensionCommandContext, action: string): Promise<boolean> {
	if (ctx.hasUI) return true;
	ctx.ui.notify(`${action} requires the interactive TUI or RPC extension UI.`, "warning");
	return false;
}

/** Show a report in Pi's editor dialog. */
export async function showText(ctx: ExtensionCommandContext, title: string, content: string): Promise<void> {
	if (!(await requireUi(ctx, title))) return;
	await ctx.ui.editor(title, content);
}

/** Parses newline, comma, or whitespace-separated operator input into unique tokens. */
export function parseListInput(text: string): string[] {
	return [...new Set(text.split(/[\s,\n]+/u).map((item) => item.trim()).filter((item) => item.length > 0))];
}

/** Converts caught errors to user-visible operator messages. */
export function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Runs an async operator task while showing transient Exa status in the TUI. */
export async function runWithStatus<T>(ctx: ExtensionCommandContext, message: string, work: () => Promise<T>): Promise<T> {
	ctx.ui.setStatus("exa", message);
	try {
		return await work();
	} finally {
		ctx.ui.setStatus("exa", undefined);
	}
}
