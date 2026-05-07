# pi-exa-tools

`pi-exa-tools` is a Pi package for direct Exa-backed web research.

After installation, Pi has:

- `exa_search`, a tool for compact web discovery through Exa `/search`.
- `exa_fetch`, a tool for clean text extraction from selected URLs through Exa `/contents`.
- `/exa`, the operator command for status, health checks, auth, settings, reset, and manual search/fetch.
- `/skill:exa-web-research`, the model-facing guide for the simple discovery-then-fetch workflow.

The package uses direct HTTP to Exa. It does not use MCP and does not patch Pi.

## Install

From npm after publication:

```bash
pi install npm:pi-exa-tools
```

From GitHub after the repository exists:

```bash
pi install git:github.com/Tiziano-AI/pi-exa-tools
```

From a local checkout:

```bash
pi install /absolute/path/to/pi-exa-tools
```

For one run without installing:

```bash
pi -e /absolute/path/to/pi-exa-tools
```

After installing in a running Pi session, use `/reload`.

Pi packages run with your local user permissions. Review package source before installing third-party packages.

## Auth

Shell environment has highest precedence:

```bash
export EXA_API_KEY="your_key_here"
export EXA_BASE_URL="https://api.exa.ai"  # optional
```

The stable Pi user auth file is the fallback source:

```env
# ~/.pi/agent/extensions/pi-exa-tools.env
EXA_API_KEY=your_key_here
# EXA_BASE_URL=https://api.exa.ai
```

You can edit that file through `/exa auth` in a UI-capable Pi session. The command writes the file with `0600` permissions. Shell environment values still override the file at runtime. The auth file is outside the package install directory so `pi update`, npm reinstalls, and git checkout cleanup do not remove it.

## Use `/exa`

Only `/exa` is registered. There are no command aliases.

Supported forms:

- `/exa`
- `/exa status`
- `/exa check`
- `/exa search <query>`
- `/exa fetch <urls>`
- `/exa auth`
- `/exa settings [global|project]`
- `/exa reset [global|project]`

Bare `/exa` opens the action picker when UI is available.

## Tool contract

### `exa_search`

Searches the web through Exa with fixed Pi-safe defaults:

- Exa `/search`
- `type: "auto"`
- exactly 10 ranked results
- highlights only
- optional trusted-source filtering with `includeDomains`

Schema:

```ts
{
  query: string;
  includeDomains?: string[];
}
```

### `exa_fetch`

Fetches clean page text from selected URLs through Exa `/contents` with fixed defaults:

- one to seven explicit HTTP(S) URLs
- text extraction only
- per-URL status reporting

Schema:

```ts
{
  urls: string[];
}
```

## Research workflow

Use the package as a simple discovery-then-fetch loop:

1. Use `exa_search` to discover promising pages.
2. Use `includeDomains` when official or trusted sources matter.
3. Pick one to a few URLs from the returned highlights.
4. Use `exa_fetch` to read selected pages as clean text.

The package intentionally does not expose Exa summaries, deep search, answer generation, subpage crawling, freshness controls, category controls, or prompt-like synthesis controls.

## Limits and truncation

`exa_search` limits:

- one natural-language query
- up to 20 `includeDomains` entries
- 10 Exa results
- highlights capped at 4000 characters per result
- model-facing content preview never exceeds 2000 lines or 50KB, whichever hits first

`exa_fetch` limits:

- one to seven explicit HTTP(S) URLs
- Exa text extraction capped at 8000 characters per URL
- model-facing content preview never exceeds 2000 lines or 50KB, whichever hits first

Over-limit arrays are rejected instead of silently clamped. Domains and URLs are normalized and deduped. Fetch URLs must use `http` or `https`; fragments are stripped before Exa receives them.

When output is truncated, the complete output is written to a temporary file and a short continuation notice is appended to the model-facing result. Use Pi's `read` tool on that path only when the omitted content is needed.

### Output preview controls

The hard safety cap for preview content stays fixed at 2000 lines or 50KB. Operators may only lower the model-facing content preview size with shell environment variables:

```bash
export PI_EXA_TOOLS_PREVIEW_LINES=400
export PI_EXA_TOOLS_PREVIEW_BYTES=20480
```

Both values are positive integers. Absent or invalid values fall back to the hard cap. Values above the hard cap are capped back to 2000 lines or 50KB. These controls affect only the final Pi presentation content preview; the continuation notice may add a small bounded read hint. They do not change Exa search result count, highlight extraction, fetch URL count, or fetched text extraction caps.

## Config

Scoped operator config lives in JSON:

- global: `~/.pi/agent/extensions/pi-exa-tools.json`
- project: `<project-root>/.pi/extensions/pi-exa-tools.json`

Project config overrides global config. The only persisted behavior flag is `enabled`. `/exa settings` shows the effective output preview limits, but those environment variables are shell launch settings and are not written by `/exa settings`.

## Cost visibility

Exa request cost is stored in tool details and rendered in the TUI result row when Exa returns it. Cost is not inserted into model-facing tool text.

## Package contents

| Surface | Purpose |
| --- | --- |
| `exa_search` | Model-callable source discovery. |
| `exa_fetch` | Model-callable clean page retrieval. |
| `/exa` | Operator command hub. |
| `/skill:exa-web-research` | Agent guidance for current web research. |
| `extensions/exa-tools/` | Pi extension runtime. |
| `skills/exa-web-research/` | Companion skill and examples. |
| `CHANGELOG.md` | Release notes and contributor credits. |

## Development checks

Run the normal local gate before changing package behavior or public docs:

```bash
pnpm run gate
npm pack --dry-run --json
git diff --check
```

`pnpm run gate` runs package-local TypeScript source typechecking, deterministic unit tests, package-load checks, npm package-content checks, and source-size checks. It does not run live Exa calls by default.

Optional live smoke, when Exa credentials are available and network/API cost is acceptable:

```bash
PI_EXA_LIVE_SMOKE=1 pnpm run smoke:live
```

Verify package command and skill discovery from a local checkout:

```bash
printf '{"type":"get_commands"}\n' | pi --mode rpc --no-session --no-context-files --no-prompt-templates --no-themes --no-extensions -e /absolute/path/to/pi-exa-tools
```

Expected package-owned surfaces:

```text
exa
skill:exa-web-research
```

## Release choreography

Publication, source push, tag push, and GitHub Release creation are human-owned stop points. Do not run them without explicit approval.

Recommended release flow:

```bash
pnpm run gate
npm pack --dry-run --json
git diff --check
git status -sb
git add -A
git commit -m "Prepare pi-exa-tools release"
```

If `package.json` still needs a version bump, run `npm version <major|minor|patch|x.y.z>` after the change commit so npm creates the version commit and tag. If the intended version is already present, create the matching tag after the commit instead:

```bash
git tag "v$(node -p 'require("./package.json").version')"
```

Re-run the release-candidate proof after the version commit/tag:

```bash
pnpm run gate
npm pack --dry-run --json
git diff --check
git status -sb
git tag --points-at HEAD
```

Then stop for approval before publication:

```bash
npm publish
```

After npm publication is confirmed, verify the registry artifact, then push source and tag:

```bash
npm view pi-exa-tools@$(node -p 'require("./package.json").version') version dist.integrity dist.tarball --json
git push origin main --follow-tags
```

Create the GitHub Release only after npm publication and source/tag push are confirmed.
