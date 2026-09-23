# pi-exa-tools

`pi-exa-tools` is a Pi package with one promise: simple Exa-backed web
discovery and selected-page fetching for Pi. It gives the model two tools,
`exa_search` and `exa_fetch`, gives the operator one command, `/exa`, and ships
one companion skill, `exa-web-research`. It is published on npm, GitHub
(`Tiziano-AI/pi-exa-tools`) and pi.dev, has outside contributors, and has real
users: changes to the tool schemas, the `/exa` forms, and the auth and config
file locations reach their installs through `pi update`. Compatibility is owed
to them. Keep existing tool inputs, `/exa` subcommands, auth and config
locations and the `enabled` config working; when a break is unavoidable, ship
it as a deliberate version bump whose `CHANGELOG.md` entry says what changed
and how to migrate, rather than as a silent change.

## Where things live

- `README.md`: the human-facing install, auth, `/exa`, tool contract, limits,
  development checks and a compact release outline that agrees with
  "Releasing" below.
- `package.json`: npm identity, the `pi` manifest, peer dependencies, the
  `files` allowlist that decides what npm ships, and the scripts.
- `CHANGELOG.md`: release notes and contributor credits. GitHub Release notes
  are taken from it.
- `extensions/exa-tools/index.ts`: the extension entry point. It registers
  `exa_search`, `exa_fetch` and `/exa`, and owns the model-visible tool
  descriptions and prompt guidelines and the custom TUI rendering. It composes
  the modules below rather than absorbing their logic.
- `extensions/exa-tools/src/`, one owner per concern:
  - `schemas.ts` and `tool-types.ts`: the model-callable input contract and the
    structured details kept for TUI rendering.
  - `mappers.ts`: fixed Exa payload defaults, input normalization, URL and
    domain validation, deduplication and hard request bounds. `api-types.ts`
    mirrors only the Exa fields the package consumes.
  - `exa-client.ts`: HTTP transport, cancellation, retry classification and Exa
    error envelopes. `rate-limit.ts`: bounded in-process request lanes.
  - `operations.ts`: search, fetch and health-check orchestration and final
    preview truncation. `format.ts`: model-facing result text and structured
    details. `preview-limits.ts`: the lower-only preview limits and how they
    are described to operator and model.
  - `config.ts`: Exa auth resolution and the `0600` user auth file.
    `settings.ts`: the global and project `enabled` config. `project.ts`:
    project-root resolution.
  - `commands.ts`, `manual-actions.ts`, `command-ui.ts` and
    `operator-helpers.ts`: `/exa` parsing, UI requirements, the
    status/auth/settings/reset flows and manual search/fetch.
  - `reports.ts`: operator-facing reports. Operator-only cost and config
    provenance stay here and out of model-facing result text.
- `skills/exa-web-research/`: `SKILL.md` and `references/query-patterns.md`,
  the model-facing guide to discovery-first, fetch-narrow research.
- `tests/`: unit tests for mappers, formatting, auth config, fetch operations
  against a loopback server, preview limits, reports and `/exa` argument
  parsing, plus package registration, packed contents, source size and an
  opt-in live smoke test.
- `ARCH.md`: the research contract, Exa mode and cost rationale, the list of
  deliberately retired Exa controls, the auth and config boundaries and the
  runtime flow. It is a maintainer's local file (see below), so public clones
  do not have it.

This guide is tracked in Git and is not package content. `ARCH.md`, `PLAN.md`,
`HANDOFF.md`, `CONTINUE.md`, `VISION.md`, `MAINTAINER.md` and `.pi/` are local
notes and runtime state that `.gitignore` keeps out of Git. The `package.json`
`files` allowlist, with `tests/check-pack.ts` as its check, keeps all of them
and this guide out of the npm tarball; keep it that way.

When behavior crosses modules, change the owning module first and carry the
contract through schemas and types, the entry-point wording, reports, tests,
README and the companion skill as they apply. Do not add a second mapping,
formatting, config or truncation path to avoid changing the owner. Each
extension `.ts` file must stay within 500 lines and 18 KB
(`tests/check-source-size.ts`), so split a module that outgrows it.

## Product contract

Keep these invariants aligned across the runtime, tests, README, skill and
package metadata:

- Exactly two model-callable tools (`exa_search`, `exa_fetch`), exactly one
  operator command (`/exa`, no aliases) and exactly one companion skill
  (`exa-web-research`).
- Direct Exa HTTP to `/search` and `/contents`. No MCP glue, and no patches to
  Pi.
- Search is discovery: fixed `type: "auto"`, 10 results, highlights only, and
  optional `includeDomains` (at most 20 after normalization).
- Fetch is selected-source evidence: one to seven HTTP(S) URLs, clean text
  only, and a status for every URL. Over-limit inputs are rejected, never
  silently clamped.
- Exa summaries, deep search, answer generation, subpage crawling, freshness,
  category, result-count and max-character controls, and prompt-like synthesis
  controls stay unexposed. Adding any of them needs an explicit architecture
  change and a cost and trust review first; `ARCH.md` holds the full retired
  list and the reasons.
- The research guidance the package gives the model and operator says: for
  unknown or fast-moving topics, begin with broad neutral discovery and do not
  preselect a provider, domain or dated terminology unless the task names it or
  the source of truth is already known; use `includeDomains` for a known
  official source or after discovery has found candidate authority domains;
  when currentness matters, include the time horizon and compare visible
  dates, versions, changelogs or publication context before making a current
  claim; treat highlights as discovery evidence and fetched text as direct
  evidence, keep source URLs, and label stale, superseded, contradictory or
  uncertain evidence. The discovery-first, `includeDomains` and currentness
  clauses appear in the `index.ts` prompt guidelines, the `reports.ts` status
  report, the README research workflow and the skill, and must agree across
  all four; the skill carries the evidence-handling guidance in full.
- Shell `EXA_API_KEY` and `EXA_BASE_URL` override the auth file
  `~/.pi/agent/extensions/pi-exa-tools.env`.
- Operator config stores only `enabled`, in
  `~/.pi/agent/extensions/pi-exa-tools.json` (global) and
  `<project-root>/.pi/extensions/pi-exa-tools.json` (project, which overrides
  global).
- `PI_EXA_TOOLS_PREVIEW_LINES` and `PI_EXA_TOOLS_PREVIEW_BYTES` are shell-only
  presentation controls that can lower, never raise, the final model-facing
  content-preview cap. `/exa settings` may show them read-only and must not
  persist them.
- The final model-facing content preview never exceeds 2000 lines or 50 KB.
  When it truncates, the full output goes to a temporary file and a short
  notice tells the model to `read` that path only if it needs the omitted part.
- Request cost appears in tool details and the TUI, never in model-facing text,
  because it distracts from choosing evidence.

The `~/.pi/agent` paths are defaults: `config.ts` and `settings.ts` use Pi's
`getAgentDir()`, which honors `PI_CODING_AGENT_DIR`, so resolve that root
before repairing auth or global settings. `project.ts` takes the project root
from `git rev-parse --show-toplevel` and falls back to the working directory
outside Git; a nested working directory is not a separate project scope.

The discovery-first and currentness wording above has no test yet: the focused
tests cover registration and the generic truncation and `read` guidance, not
these clauses, so wording can drift between the four surfaces unnoticed and
change how models research. Before releasing a version that ships this
guidance, add assertions that fail when those clauses diverge across
`index.ts`, `reports.ts`, the skill and README.

## Working with Pi

The package depends on Pi's extension semantics. Before changing tool
registration, command behavior, custom rendering, package loading or mode
behavior, re-read the documentation of the Pi that runs the package. For a
global npm install of Pi, the package root is
`$(npm root -g)/@earendil-works/pi-coding-agent/`; under it read:

- `docs/extensions.md`
- `docs/packages.md`
- the relevant examples under `examples/extensions/`

Do not patch Pi or its vendor packages, including to make an installed copy
behave like the checkout.

The checkout, an installed copy and a published release are different things,
and success at one does not carry over to the next:

- The tests and `pi -e <absolute path of this checkout>` exercise this
  checkout only. `pi list` shows which source Pi has installed; when it names this
  checkout's path, edits in the working tree, including another writer's
  uncommitted ones, reach Pi sessions at their next start or `/reload`.
- `pi install` or `pi update`, followed by `/reload` in a running session,
  changes the installed package. Read back installed behavior before saying it
  matches the checkout. When the two differ, first confirm the checkout with
  `pi -e`, then inspect or refresh the intended install and `/reload`.
- `npm pack --dry-run --json` shows the tarball npm would build from the
  current filesystem; it says nothing about what npm has published. The npm
  version, the Git commit and tag, the GitHub Release and the pi.dev page are
  separate release surfaces.
- Auth and scoped config live outside the installed package, and reinstalling
  or updating must not overwrite them. Shell auth and preview variables are
  read when Pi starts, so judge a changed environment in a new Pi process
  launched from it: `/reload` reloads resources inside the running process and
  does not see variables exported later in another shell.
- Truncation's temporary full-output files serve only the current result. Do
  not commit them.

## Checks

The normal local gate:

```bash
pnpm run gate
npm pack --dry-run --json
git diff --check
```

`pnpm run gate` runs the TypeScript typecheck, the unit tests, the pack-content
check (`check:pack`), the registration check (`check:pi-load`) and the
source-size check. Keep `PI_EXA_LIVE_SMOKE` unset or `0` for it: the test glob
includes `tests/live-smoke.test.ts`, and an inherited `1` makes real, billed
Exa calls when auth is present. The gate is not read-only either: tests write
temporary auth and output fixtures and start loopback HTTP servers, and the
pack check runs npm. For inspection-only work, read the relevant modules
instead of running the suite.

The gate needs two installs. The typecheck resolves `tsc` and the Pi types
from the package-local `node_modules`, so a fresh clone needs `pnpm install`
from `pnpm-lock.yaml` first. The tests and `check:pi-load` load Pi through
`tests/pi-peer-loader.mjs`, which resolves runtime peers from
`PI_CODING_AGENT_PACKAGE_ROOT` or, when that is unset, from the global Pi
package under `npm root -g`; the local install does not decide which Pi
runtime the tests run against.

Live Exa smoke test, only when network use and API cost are acceptable:

```bash
PI_EXA_LIVE_SMOKE=1 pnpm run smoke:live
```

Command and skill discovery from this checkout, run from the repository root:

```bash
printf '{"type":"get_commands"}\n' | pi --mode rpc --no-session --no-context-files --no-prompt-templates --no-themes --no-extensions -e "$(pwd)"
```

The package's entries in that response are `exa` and `skill:exa-web-research`,
with `sourceInfo` pointing at this checkout; other entries come from the local
Pi setup. The response does not list model tools. `check:pi-load` covers those
instead: it imports the checkout extension into a registration stub and asserts
`exa_search`, `exa_fetch` and `/exa`, but does not load the skill. Neither
check exercises an installed package or the `/exa` dialogs.

## Operator recovery

- `/exa status` does not call Exa. `/exa check` and `/exa status check` run a
  real one-result Exa search when auth is available, and that request happens
  before the report checks for a UI, so a non-UI invocation is not free.
  Operator dialogs need the interactive TUI or an RPC client that implements
  extension UI. See `commands.ts`, `command-ui.ts` and `operations.ts`.
- Missing auth: inspect where auth comes from with `/exa status`, then use
  `/exa auth` or the shell variables. Never print an API key or copy one into
  repository files.
- Disabled tools: inspect global and project `enabled` through `/exa settings`
  (project overrides global). Run `/exa reset [global|project]` only for the
  exact scope that was confirmed.
- Invalid scoped JSON: repair the file named in the error, and only that file.
  Keep the runtime failing on malformed config rather than silently ignoring
  it.
- Truncated results: follow the notice and `read` the saved file only when the
  omitted evidence is needed. The 2000-line / 50 KB cap stays.
- Package-load drift: run `pnpm run check:pi-load` and the RPC discovery
  command above, then read back the installed package if installed behavior is
  in question.
- The gate failing on a package that the active global Pi distribution imports
  but does not provide: inspect that Pi package's manifest and the failing
  import chain before touching this package's loader, and do not install or
  vendor the missing package as a workaround. An incomplete Pi distribution and
  a wrong mapping in `tests/pi-peer-loader.mjs` are different defects. After a
  Pi upgrade, diagnose again from the new distribution's imports: a missing
  package it no longer imports is not a defect, and the disappearance of the
  broken import still needs the unmodified gate to pass before you call the
  gate healthy.
- Provider failures: keep Exa's request and error context and the per-URL
  fetch status. Do not report a partial fetch failure as whole-request success,
  and do not add unbounded retries.

## Releasing

Releases are maintainer work. The step-by-step runbook (release checks, the
commit, tag and push, the hand-off for `npm publish`, and the read-back of npm,
GitHub, pi.dev and the GitHub Release) is `MAINTAINER.md`, a local file that
`.gitignore` keeps out of Git. A checkout without it carries no release
authority: do not tag, push release tags, publish or create GitHub Releases
from it. Agents never run `npm publish`; the maintainer does. The README's
release outline gives the same order in brief.

What every change that feeds a release respects:

- `npm publish` ships whatever the local filesystem holds under npm's package
  rules, not the last commit, so a release comes only from a committed,
  validated, tagged and pushed tree, and the source commit and `vX.Y.Z` tag
  reach `origin` before npm publication.
- Stage release files by name. A broad `git add -A` or `git add .` would sweep
  in other writers' unrelated work and any untracked local file.
- Each release adds a `## X.Y.Z - YYYY-MM-DD` section to `CHANGELOG.md`, which
  also supplies the GitHub Release notes and credits contributors, and keeps
  README, skill copy, package metadata, tool and command descriptions, tests
  and package-file assertions in line with what ships.
- The dry-run pack includes `README.md`, `CHANGELOG.md`, `LICENSE`,
  `extensions/**/*.ts`, `skills/**/*.md` and `package.json`, and excludes this
  guide, local notes, `.pi/`, credentials, tarballs, tests, `node_modules` and
  package-manager caches.
- A release is finished only when the source commit, Git tag, npm package,
  GitHub Release and pi.dev page all agree.

## What never goes into Git

Do not commit credentials, `.npmrc`, `.env*`, local Pi config, generated
tarballs, runtime temporary files, `node_modules`, package-manager caches, or
`.cdx-continue/`, continuation state that a maintainer's Codex tooling may
write at the repository root. That directory ignores itself through its own
`.gitignore`; never force-add it.
