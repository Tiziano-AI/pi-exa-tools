import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const rawPackage: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
assert.equal(typeof rawPackage === "object" && rawPackage !== null, true);
assert.equal("pi" in rawPackage, true);
const piManifest = rawPackage.pi;
assert.equal(typeof piManifest === "object" && piManifest !== null, true);
assert.equal("extensions" in piManifest, true);
assert.equal(Array.isArray(piManifest.extensions), true);
assert.equal(piManifest.extensions.length, 1);

interface RegisteredTool {
	name: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: object;
}

interface RegisteredCommand {
	description: string;
	handler: unknown;
}

for (const extensionPath of piManifest.extensions) {
	assert.equal(typeof extensionPath, "string");
	const moduleUrl = pathToFileURL(join(packageRoot, extensionPath)).href;
	const moduleRecord: unknown = await import(moduleUrl);
	assert.equal(typeof moduleRecord === "object" && moduleRecord !== null && "default" in moduleRecord, true);
	const extension = moduleRecord.default;
	assert.equal(typeof extension, "function", `${extensionPath} default export should be a Pi extension function`);
	const tools: RegisteredTool[] = [];
	const commands = new Map<string, RegisteredCommand>();
	extension({
		registerTool(tool: RegisteredTool) {
			tools.push(tool);
		},
		registerCommand(name: string, command: RegisteredCommand) {
			commands.set(name, command);
		},
	});
	assert.deepEqual(tools.map((tool) => tool.name).sort(), ["exa_fetch", "exa_search"]);
	assert.equal(tools.every((tool) => tool.description.length > 0 && tool.promptSnippet && tool.promptSnippet.length > 0), true);
	for (const tool of tools) {
		assert.match(tool.description, /Output content preview is truncated/);
		assert.match(tool.description, /full output is saved to a temp file/);
		assert.equal(tool.promptGuidelines?.some((guideline) => guideline.includes("read on that path")), true);
	}
	assert.equal(commands.has("exa"), true);
	assert.equal(typeof commands.get("exa")?.handler, "function");
}
