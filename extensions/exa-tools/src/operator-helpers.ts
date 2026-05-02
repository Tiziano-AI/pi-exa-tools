export type ExaAction = "status" | "check" | "search" | "fetch" | "auth" | "settings" | "reset";

/** Parsed `/exa` command action plus any remaining user text. */
export interface ParsedExaCommand {
	action: ExaAction | undefined;
	remainder: string;
}

const ACTIONS: ExaAction[] = ["status", "check", "search", "fetch", "auth", "settings", "reset"];

function resolveAction(value: string): ExaAction | undefined {
	return ACTIONS.find((action) => action === value);
}

/** Parses `/exa` command arguments without treating unknown actions as valid. */
export function parseExaCommandInput(args: string | undefined): ParsedExaCommand {
	const trimmed = args?.trim() ?? "";
	if (trimmed.length === 0) {
		return { action: undefined, remainder: "" };
	}
	const firstSpaceIndex = trimmed.indexOf(" ");
	const firstToken = (firstSpaceIndex >= 0 ? trimmed.slice(0, firstSpaceIndex) : trimmed).toLowerCase();
	const action = resolveAction(firstToken);
	if (!action) {
		return { action: undefined, remainder: trimmed };
	}
	return {
		action,
		remainder: firstSpaceIndex >= 0 ? trimmed.slice(firstSpaceIndex + 1).trim() : "",
	};
}

/** Builds a ready-to-edit follow-up `/exa fetch` command from selected URLs. */
export function buildFetchCommandFromUrls(urls: string[]): string | undefined {
	return urls.length > 0 ? `/exa fetch ${urls.join(" ")}` : undefined;
}
