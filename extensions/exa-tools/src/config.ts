import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir, withFileMutationQueue } from "@earendil-works/pi-coding-agent";

/** Runtime Exa HTTP configuration after auth resolution. */
export interface ExaConfig {
	apiKey: string;
	baseUrl: string;
}

/** Provenance for an Exa configuration value. */
export type ConfigValueSource = "env" | "auth-file" | "default" | "missing";

/** Resolved Exa auth state plus editable auth-file metadata. */
export interface ExaAuthState {
	config: ExaConfig | undefined;
	apiKeySource: ConfigValueSource;
	baseUrlSource: ConfigValueSource;
	authFilePath: string;
	authFileExists: boolean;
	authFileText: string | undefined;
}

interface AuthFileValues {
	apiKey?: string;
	baseUrl?: string;
}

interface ParsedEnvLine {
	key: "EXA_API_KEY" | "EXA_BASE_URL";
	value: string;
}

const DEFAULT_EXA_BASE_URL = "https://api.exa.ai";
const AUTH_FILE_NAME = "pi-exa-tools.env";

function normalizeConfiguredValue(value: string | undefined): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readConfiguredValue(runtimeValue: string | undefined, fileValue: string | undefined): { value: string | undefined; source: ConfigValueSource } {
	const runtime = normalizeConfiguredValue(runtimeValue);
	if (runtime) {
		return { value: runtime, source: "env" };
	}
	const file = normalizeConfiguredValue(fileValue);
	if (file) {
		return { value: file, source: "auth-file" };
	}
	return { value: undefined, source: "missing" };
}

function normalizeEnvFileValue(value: string): string | undefined {
	if (value.length >= 2) {
		const startsWithDoubleQuote = value.startsWith('"') && value.endsWith('"');
		const startsWithSingleQuote = value.startsWith("'") && value.endsWith("'");
		if (startsWithDoubleQuote || startsWithSingleQuote) {
			return normalizeConfiguredValue(value.slice(1, -1));
		}
	}
	return normalizeConfiguredValue(value);
}

function parseAuthFileLine(line: string): ParsedEnvLine | undefined {
	const trimmedLine = line.trim();
	if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
		return undefined;
	}
	const normalizedLine = trimmedLine.startsWith("export ") ? trimmedLine.slice(7).trim() : trimmedLine;
	const equalsIndex = normalizedLine.indexOf("=");
	if (equalsIndex <= 0) {
		return undefined;
	}
	const key = normalizedLine.slice(0, equalsIndex).trim();
	const value = normalizeEnvFileValue(normalizedLine.slice(equalsIndex + 1).trim());
	if (!value) {
		return undefined;
	}
	if (key === "EXA_API_KEY" || key === "EXA_BASE_URL") {
		return { key, value };
	}
	return undefined;
}

function parseAuthFileValues(text: string): AuthFileValues {
	const values: AuthFileValues = {};
	for (const line of text.split(/\r?\n/u)) {
		const parsedLine = parseAuthFileLine(line);
		if (!parsedLine) {
			continue;
		}
		if (parsedLine.key === "EXA_API_KEY") {
			values.apiKey = parsedLine.value;
		}
		if (parsedLine.key === "EXA_BASE_URL") {
			values.baseUrl = parsedLine.value;
		}
	}
	return values;
}

function readAuthFileText(path: string): string | undefined {
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function normalizeEditableEnvText(text: string): string {
	const normalized = text.replace(/\r\n/g, "\n").trim();
	return normalized.length > 0 ? `${normalized}\n` : "";
}

/** Returns the stable editable Exa auth file path under Pi's user config root. */
export function getAuthFilePath(): string {
	return join(getAgentDir(), "extensions", AUTH_FILE_NAME);
}

/** Returns the editable template for Exa auth. */
export function getAuthFileTemplate(): string {
	return "# Local auth for pi-exa-tools\n# Shell environment values override this file at runtime.\nEXA_API_KEY=\n# EXA_BASE_URL=https://api.exa.ai\n";
}

/** Resolves Exa auth from shell env first and the stable Pi user auth file second. */
export function readExaAuthState(options?: { env?: Record<string, string | undefined>; authFilePath?: string }): ExaAuthState {
	const authFilePath = options?.authFilePath ?? getAuthFilePath();
	const authFileText = readAuthFileText(authFilePath);
	const authFileValues = parseAuthFileValues(authFileText ?? "");
	const env = options?.env ?? process.env;
	const apiKey = readConfiguredValue(env.EXA_API_KEY, authFileValues.apiKey);
	const baseUrl = readConfiguredValue(env.EXA_BASE_URL, authFileValues.baseUrl);
	return {
		config: apiKey.value
			? {
				apiKey: apiKey.value,
				baseUrl: (baseUrl.value ?? DEFAULT_EXA_BASE_URL).replace(/\/+$/g, ""),
			}
			: undefined,
		apiKeySource: apiKey.source,
		baseUrlSource: baseUrl.value ? baseUrl.source : "default",
		authFilePath,
		authFileExists: authFileText !== undefined,
		authFileText,
	};
}

/** Returns the configured Exa base URL and API key when available. */
export function readExaConfig(): ExaConfig | undefined {
	return readExaAuthState().config;
}

/** Returns a human-readable message for missing Exa auth. */
export function getMissingApiKeyMessage(): string {
	return `EXA_API_KEY is not set. Export it in your shell or add it to ${getAuthFilePath()} before using Exa.`;
}

/** Persist the stable Pi user auth file. */
export async function writeAuthFile(text: string, path: string = getAuthFilePath()): Promise<void> {
	const normalized = normalizeEditableEnvText(text);
	await withFileMutationQueue(path, async () => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, normalized, { encoding: "utf8", mode: 0o600 });
		await chmod(path, 0o600);
	});
}

/** Remove the stable Pi user auth file. */
export async function removeAuthFile(path: string = getAuthFilePath()): Promise<void> {
	await withFileMutationQueue(path, async () => {
		if (!existsSync(path)) return;
		await rm(path, { force: true });
	});
}
