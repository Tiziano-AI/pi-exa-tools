# Query patterns

## Official docs

Use product names, endpoint names, and source filters.

- `OpenAI Responses API tool calling docs`
- `Anthropic Messages API tool use docs`
- `Exa search api coding agents docs`

Prefer:
- `includeDomains: ["openai.com"]`
- `includeDomains: ["docs.anthropic.com"]`
- `includeDomains: ["exa.ai"]`

## Code examples

Describe the implementation task directly in the query.

- `Python asyncio rate limiter with semaphore and backoff example`
- `Next.js app router server action form validation example`
- `TypeScript fetch retry helper with abort signal example`

## News and current events

State the time horizon in the query.

- `latest EU AI Act enforcement updates in 2026`
- `recent OpenAI product announcements this month`

## Company, people, and financial lookup

Name the target class and constraints in the query.

- `US agtech companies that raised Series A funding`
- `AI safety researchers working on mechanistic interpretability`
- `NVIDIA fiscal 2025 10-K annual report`

## Search then fetch

Good pattern:
1. `exa_search` with a precise natural-language query and source filters when useful.
2. Pick one to three URLs by default, or up to seven when each source is already intentional.
3. `exa_fetch` those URLs for clean text.
4. If Exa output is truncated and gives a full-output path, use `read` on that path only when omitted lines are necessary.

Avoid:
- fetching every returned URL without triage
- asking for AI-generated summaries when direct text is available
- using Exa as a deep-research synthesizer inside this package
