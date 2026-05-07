import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
} from "@earendil-works/pi-coding-agent";

/** Environment variable that may lower the final model-facing preview line cap. */
export const PREVIEW_LINES_ENV = "PI_EXA_TOOLS_PREVIEW_LINES";

/** Environment variable that may lower the final model-facing preview byte cap. */
export const PREVIEW_BYTES_ENV = "PI_EXA_TOOLS_PREVIEW_BYTES";

/** Source of an effective preview limit decision. */
export type PreviewLimitSource = "default" | "env" | "invalid" | "capped";

/** One materialized lower-only output preview limit. */
export interface PreviewLimitDecision {
	envName: string;
	value: number;
	hardMax: number;
	source: PreviewLimitSource;
	rawValue?: string;
}

/** Effective lower-only output preview limits for Exa tool text. */
export interface PreviewLimits {
	lines: PreviewLimitDecision;
	bytes: PreviewLimitDecision;
}

export type PreviewLimitEnv = Record<string, string | undefined>;

/** Returns effective content-preview limits, clamped so they never exceed Pi's hard output cap. */
export function resolvePreviewLimits(env: PreviewLimitEnv = process.env): PreviewLimits {
	return {
		lines: resolveLimit(env, PREVIEW_LINES_ENV, DEFAULT_MAX_LINES),
		bytes: resolveLimit(env, PREVIEW_BYTES_ENV, DEFAULT_MAX_BYTES),
	};
}

/** Converts materialized limits into the shape expected by Pi's truncation helpers. */
export function toTruncationOptions(limits: PreviewLimits): { maxLines: number; maxBytes: number } {
	return {
		maxLines: limits.lines.value,
		maxBytes: limits.bytes.value,
	};
}

/** Formats the effective content-preview cap for model-facing descriptions and operator reports. */
export function formatPreviewLimitSummary(limits: PreviewLimits): string {
	return `${limits.lines.value} lines or ${formatSize(limits.bytes.value)}`;
}

/** Formats Pi's package hard cap for docs and model-facing descriptions. */
export function formatHardLimitSummary(): string {
	return `${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}`;
}

/** Returns a concise settings-row label for the active preview policy. */
export function formatPreviewSettingsLabel(limits: PreviewLimits = resolvePreviewLimits()): string {
	return `output preview: ${formatPreviewLimitSummary(limits)}; larger output saved to temp file`;
}

/** Returns a short settings hint for read-only preview controls. */
export function formatPreviewSettingsHint(limits: PreviewLimits = resolvePreviewLimits()): string {
	return `Output over ${formatPreviewLimitSummary(limits)} is saved to a temp file. Set ${PREVIEW_LINES_ENV}/${PREVIEW_BYTES_ENV} in the shell to lower the preview.`;
}

/** Returns a concise tool-description sentence for the active preview policy. */
export function formatPreviewToolSentence(limits: PreviewLimits = resolvePreviewLimits()): string {
	const preview = formatPreviewLimitSummary(limits);
	const hardCap = formatHardLimitSummary();
	const lowered = limits.lines.value < DEFAULT_MAX_LINES || limits.bytes.value < DEFAULT_MAX_BYTES;
	const capText = lowered ? `lowered to ${preview}; hard cap ${hardCap}` : preview;
	return `Output content preview is truncated to ${capText}. If truncated, full output is saved to a temp file for follow-up read.`;
}

/** Returns operator-facing origin lines for the active preview policy. */
export function formatPreviewLimitOriginLines(limits: PreviewLimits = resolvePreviewLimits()): string[] {
	return [
		`- Lines: ${describeDecision(limits.lines, "lines")}`,
		`- Bytes: ${describeDecision(limits.bytes, "bytes")}`,
	];
}

function resolveLimit(env: PreviewLimitEnv, envName: string, hardMax: number): PreviewLimitDecision {
	const raw = env[envName];
	if (raw === undefined || raw.trim().length === 0) {
		return { envName, value: hardMax, hardMax, source: "default" };
	}

	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) {
		return { envName, value: hardMax, hardMax, source: "invalid", rawValue: trimmed };
	}

	const parsed = Number(trimmed);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		return { envName, value: hardMax, hardMax, source: "invalid", rawValue: trimmed };
	}
	if (parsed > hardMax) {
		return { envName, value: hardMax, hardMax, source: "capped", rawValue: trimmed };
	}
	return { envName, value: parsed, hardMax, source: "env", rawValue: trimmed };
}

function describeDecision(decision: PreviewLimitDecision, unit: "lines" | "bytes"): string {
	const value = unit === "bytes" ? formatSize(decision.value) : `${decision.value}`;
	const hardMax = unit === "bytes" ? formatSize(decision.hardMax) : `${decision.hardMax}`;
	if (decision.source === "default") {
		return `${value} default`;
	}
	if (decision.source === "env") {
		return `${value} from ${decision.envName}`;
	}
	if (decision.source === "invalid") {
		return `${value} default; ignored invalid ${decision.envName}=${formatRawValue(decision.rawValue)}`;
	}
	return `${value} hard cap; capped ${decision.envName}=${formatRawValue(decision.rawValue)} to ${hardMax}`;
}

function formatRawValue(value: string | undefined): string {
	const normalized = (value ?? "").replace(/\s+/g, " ").trim();
	if (normalized.length === 0) {
		return "(empty)";
	}
	const maxChars = 80;
	if (normalized.length <= maxChars) {
		return JSON.stringify(normalized);
	}
	return `${JSON.stringify(normalized.slice(0, maxChars))}...`;
}
