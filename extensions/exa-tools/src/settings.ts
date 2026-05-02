import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import type { ExaFetchInput, ExaSearchInput } from "./tool-types.ts";

/** Scope for persisted Exa operator configuration. */
export type ConfigScope = "global" | "project";

/** Persisted operator settings; only controls package availability. */
export interface ExaOperatorConfig {
	enabled: boolean;
}

interface PartialExaOperatorConfig {
	enabled?: boolean;
}

/** Default operator config used when no scoped JSON config exists. */
export const DEFAULT_EXA_OPERATOR_CONFIG: ExaOperatorConfig = {
	enabled: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function parsePartialConfig(value: unknown): PartialExaOperatorConfig {
	if (!isRecord(value)) return {};
	return {
		enabled: asBoolean(value.enabled),
	};
}

function readPartialConfig(path: string): PartialExaOperatorConfig {
	if (!existsSync(path)) return {};
	try {
		return parsePartialConfig(JSON.parse(readFileSync(path, "utf8")));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid pi-exa-tools config at ${path}: ${message}`);
	}
}

/** Normalizes partial config to the canonical persisted config contract. */
export function normalizeOperatorConfig(partial: PartialExaOperatorConfig): ExaOperatorConfig {
	return {
		enabled: partial.enabled ?? DEFAULT_EXA_OPERATOR_CONFIG.enabled,
	};
}

/** Merges global and project config with project values taking precedence. */
export function mergeOperatorConfig(globalConfig: PartialExaOperatorConfig, projectConfig: PartialExaOperatorConfig): ExaOperatorConfig {
	return normalizeOperatorConfig({ ...globalConfig, ...projectConfig });
}

/** Returns the global Exa package config path. */
export function getGlobalConfigPath(): string {
	return join(getAgentDir(), "extensions", "pi-exa-tools.json");
}

/** Returns the project-local Exa package config path. */
export function getProjectConfigPath(projectRoot: string): string {
	return join(projectRoot, ".pi", "extensions", "pi-exa-tools.json");
}

/** Loads effective operator config from global and project scopes. */
export function loadOperatorConfig(projectRoot: string): ExaOperatorConfig {
	return mergeOperatorConfig(readPartialConfig(getGlobalConfigPath()), readPartialConfig(getProjectConfigPath(projectRoot)));
}

/** Loads only the requested scoped operator config. */
export function loadScopedOperatorConfig(scope: ConfigScope, projectRoot: string): ExaOperatorConfig {
	const partial = readPartialConfig(getConfigPath(scope, projectRoot));
	return normalizeOperatorConfig(partial);
}

function serializeConfig(config: ExaOperatorConfig): string {
	return `${JSON.stringify(config, null, 2)}\n`;
}

function getConfigPath(scope: ConfigScope, projectRoot: string): string {
	return scope === "global" ? getGlobalConfigPath() : getProjectConfigPath(projectRoot);
}

/** Saves scoped operator config using Pi's file mutation queue. */
export async function saveOperatorConfig(scope: ConfigScope, projectRoot: string, config: ExaOperatorConfig): Promise<void> {
	const targetPath = getConfigPath(scope, projectRoot);
	await withFileMutationQueue(targetPath, async () => {
		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(targetPath, serializeConfig(config), "utf8");
	});
}

/** Deletes scoped operator config when present. */
export async function resetOperatorConfig(scope: ConfigScope, projectRoot: string): Promise<void> {
	const targetPath = getConfigPath(scope, projectRoot);
	await withFileMutationQueue(targetPath, async () => {
		if (!existsSync(targetPath)) return;
		await rm(targetPath, { force: true });
	});
}

/** Preserves the minimal search input contract; fixed defaults live in the mapper. */
export function applySearchDefaults(input: ExaSearchInput, _config: ExaOperatorConfig): ExaSearchInput {
	return input;
}

/** Preserves the minimal fetch input contract; fixed defaults live in the mapper. */
export function applyFetchDefaults(input: ExaFetchInput, _config: ExaOperatorConfig): ExaFetchInput {
	return input;
}
