# Query patterns

## Unknown or fast-moving source landscape

Start with neutral discovery before naming providers, vendors, domains, or dated terminology. The first search should map current terms, candidate authorities, standards, primary sources, and contradictions.

- `current AI coding agent subagent orchestration docs standards and primary sources in 2026`
- `current browser automation agent protocols official documentation and maintainer sources in 2026`
- `primary sources and current terminology for local AI model serving APIs in 2026`

After discovery identifies the authoritative candidates, run a narrower search or fetch selected primary URLs. Avoid starting with a familiar provider filter when the task asks what exists now.

## Known official docs

Use product names, endpoint names, and source filters when the task already names the product or discovery has identified the source of truth.

- `OpenAI Responses API tool calling docs`
- `Anthropic Messages API tool use docs`
- `Exa search api coding agents docs`

Prefer after the official source is known:
- `includeDomains: ["openai.com"]`
- `includeDomains: ["docs.anthropic.com"]`
- `includeDomains: ["exa.ai"]`

## Code examples

Describe the implementation task directly in the query.

- `Python asyncio rate limiter with semaphore and backoff example`
- `Next.js app router server action form validation example`
- `TypeScript fetch retry helper with abort signal example`

## News and current events

State the time horizon in the query and prefer primary sources, official announcements, regulator pages, filings, or direct transcripts before secondary summaries.

- `primary sources for EU AI Act enforcement updates in 2026`
- `OpenAI official product announcements this month`

## Company, people, and financial lookup

Name the target class and constraints in the query.

- `US agtech companies that raised Series A funding`
- `AI safety researchers working on mechanistic interpretability`
- `NVIDIA fiscal 2025 10-K annual report`

## Search then fetch

Good pattern:
1. Use neutral `exa_search` first for unknown or current domains; use `includeDomains` only for a known official source or after discovery identifies candidate authorities.
2. Pick one to three URLs by default, or up to seven when each source is already intentional.
3. `exa_fetch` those URLs for clean text.
4. Compare visible dates, versions, changelogs, or publication context before making current claims.
5. If Exa output is truncated and gives a full-output path, use `read` on that path only when omitted lines are necessary.

Avoid:
- fetching every returned URL without triage
- asking for AI-generated summaries when direct text is available
- using Exa as a deep-research synthesizer inside this package
- preselecting a provider, domain, or year because it is familiar rather than task-grounded
