import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";
import {
	formatHardLimitSummary,
	formatPreviewLimitOriginLines,
	formatPreviewLimitSummary,
	formatPreviewSettingsLabel,
	formatPreviewToolSentence,
	PREVIEW_BYTES_ENV,
	PREVIEW_LINES_ENV,
	resolvePreviewLimits,
	toTruncationOptions,
} from "../extensions/exa-tools/src/preview-limits.ts";

test("resolvePreviewLimits uses Pi hard caps when env is absent", () => {
	const limits = resolvePreviewLimits({});

	assert.equal(limits.lines.value, DEFAULT_MAX_LINES);
	assert.equal(limits.lines.source, "default");
	assert.equal(limits.bytes.value, DEFAULT_MAX_BYTES);
	assert.equal(limits.bytes.source, "default");
	assert.deepEqual(toTruncationOptions(limits), {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
});

test("resolvePreviewLimits accepts smaller positive integer env values", () => {
	const limits = resolvePreviewLimits({
		[PREVIEW_LINES_ENV]: "120",
		[PREVIEW_BYTES_ENV]: "8192",
	});

	assert.equal(limits.lines.value, 120);
	assert.equal(limits.lines.source, "env");
	assert.equal(limits.bytes.value, 8192);
	assert.equal(limits.bytes.source, "env");
	assert.equal(formatPreviewLimitSummary(limits), "120 lines or 8.0KB");
});

test("resolvePreviewLimits rejects invalid env values", () => {
	const limits = resolvePreviewLimits({
		[PREVIEW_LINES_ENV]: "0",
		[PREVIEW_BYTES_ENV]: "10.5",
	});

	assert.equal(limits.lines.value, DEFAULT_MAX_LINES);
	assert.equal(limits.lines.source, "invalid");
	assert.equal(limits.bytes.value, DEFAULT_MAX_BYTES);
	assert.equal(limits.bytes.source, "invalid");
});

test("resolvePreviewLimits caps values above Pi's hard maximum", () => {
	const limits = resolvePreviewLimits({
		[PREVIEW_LINES_ENV]: `${DEFAULT_MAX_LINES + 1}`,
		[PREVIEW_BYTES_ENV]: `${DEFAULT_MAX_BYTES + 1}`,
	});

	assert.equal(limits.lines.value, DEFAULT_MAX_LINES);
	assert.equal(limits.lines.source, "capped");
	assert.equal(limits.bytes.value, DEFAULT_MAX_BYTES);
	assert.equal(limits.bytes.source, "capped");
});

test("formatPreviewSettingsLabel keeps settings concise", () => {
	assert.equal(
		formatPreviewSettingsLabel(resolvePreviewLimits({})),
		"output preview: 2000 lines or 50.0KB; larger output saved to temp file",
	);
	const lowered = resolvePreviewLimits({ [PREVIEW_LINES_ENV]: "25" });
	assert.equal(
		formatPreviewSettingsLabel(lowered),
		"output preview: 25 lines or 50.0KB; larger output saved to temp file",
	);
});

test("formatPreviewLimitOriginLines sanitizes raw env values", () => {
	const limits = resolvePreviewLimits({
		[PREVIEW_LINES_ENV]: "not\nvalid\tvalue",
		[PREVIEW_BYTES_ENV]: `${DEFAULT_MAX_BYTES + 500}`,
	});
	const lines = formatPreviewLimitOriginLines(limits);

	assert.equal(lines.some((line) => line.includes("\nvalid")), false);
	assert.equal(lines.some((line) => line.includes('"not valid value"')), true);
	assert.equal(lines.some((line) => line.includes(`"${DEFAULT_MAX_BYTES + 500}"`)), true);
});

test("formatPreviewToolSentence tells models when and how to continue", () => {
	const lowered = resolvePreviewLimits({
		[PREVIEW_LINES_ENV]: "25",
		[PREVIEW_BYTES_ENV]: "4096",
	});
	const sentence = formatPreviewToolSentence(lowered);

	assert.match(sentence, /lowered to 25 lines or 4\.0KB/);
	assert.match(sentence, new RegExp(`hard cap ${formatHardLimitSummary().replace(".", "\\.")}`));
	assert.match(sentence, /full output is saved to a temp file/);
	assert.match(sentence, /follow-up read/);
});
