import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readExaAuthState, removeAuthFile, writeAuthFile } from "../extensions/exa-tools/src/config.ts";

test("readExaAuthState prefers shell env over auth file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pi-exa-auth-"));
	const authFilePath = join(dir, "pi-exa-tools.env");
	await writeAuthFile("EXA_API_KEY=file-key\nEXA_BASE_URL=https://file.example\n", authFilePath);
	const auth = readExaAuthState({
		env: { EXA_API_KEY: "env-key", EXA_BASE_URL: "https://env.example" },
		authFilePath,
	});

	assert.equal(auth.config?.apiKey, "env-key");
	assert.equal(auth.config?.baseUrl, "https://env.example");
	assert.equal(auth.apiKeySource, "env");
	assert.equal(auth.baseUrlSource, "env");
});

test("writeAuthFile normalizes trailing newline and removeAuthFile deletes it", async () => {
	const dir = await mkdtemp(join(tmpdir(), "pi-exa-auth-"));
	const authFilePath = join(dir, "pi-exa-tools.env");
	await writeAuthFile("EXA_API_KEY=test-key", authFilePath);
	assert.equal(await readFile(authFilePath, "utf8"), "EXA_API_KEY=test-key\n");
	assert.equal((await stat(authFilePath)).mode & 0o777, 0o600);
	await removeAuthFile(authFilePath);
	const auth = readExaAuthState({ env: {}, authFilePath });
	assert.equal(auth.authFileExists, false);
	assert.equal(auth.config, undefined);
});
