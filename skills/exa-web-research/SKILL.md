---
name: exa-web-research
description: Use when a task depends on current web facts, official documentation, public announcements, or external code examples that are not already in the workspace. Uses a discovery-first Exa search then selected fetch workflow.
---

# Exa web research

## When to use

Use this skill when:
- the answer depends on current information from the public web
- you need official docs or release notes outside the workspace
- you need external code examples, library usage, or API snippets
- you need to compare a few candidate sources before going deeper

Do not use this skill when:
- the answer is already grounded in the local repo or provided files
- the user wants provider-hosted web search rather than local tool-based search
- broad deep research would be overkill for a focused question

## Canonical workflow

1. If the source landscape is unknown or fast-moving, start with a broad, neutral `exa_search` to map current terminology, candidate authorities, standards, and primary sources. Do not preselect providers, vendors, domains, or dated terminology unless the user/task names them or the source of truth is already known.
2. If the official source is already known, or after discovery identifies authoritative candidates, use `includeDomains` for source narrowing.
3. Read the returned highlights and choose promising URLs.
4. Fetch only those URLs with `exa_fetch`.
5. When recency matters, compare visible dates, versions, changelogs, or publication context before treating evidence as current.
6. Prefer refining the natural-language query over adding knobs.

## Query discipline

- Write natural-language queries, not short keyword fragments.
- For unknown or current fields, ask a source-agnostic discovery question before using named-provider filters.
- Do not anchor a query on a familiar provider, framework, year, or domain unless it is part of the task or already proven authoritative.
- For docs, include product and surface names only when the target product is known.
- For code, mention the language, framework, and task in the query when those constraints are part of the task.
- For current events, include the time horizon in the query.
- For company, people, research paper, or financial-report work, name the target class in the query instead of using category controls.

## Output discipline

- Keep search broad and fetch narrow.
- Do not fetch every result by default.
- Summarize the evidence with source URLs.
- Report visible dates, versions, source type, and provenance when they affect currentness.
- Label stale, superseded, contradictory, or uncertain evidence instead of presenting it as current.
- If search comes back thin, refine the query and run another search instead of looking for hidden knobs.
- Treat fetched text as direct evidence and highlights as discovery evidence.
- If a result says full output was saved to a temp file, use `read` on that path only when the omitted content is needed for the answer.
- Fetch one to three URLs by default; use the seven-URL cap only when each source is already selected intentionally.

## Examples

- Unknown current landscape:
  - `exa_search(query="current AI coding agent subagent orchestration docs standards and primary sources in 2026")`
- Known official docs:
  - `exa_search(query="OpenAI Responses API tools docs", includeDomains=["openai.com"])`
- Code examples with known stack:
  - `exa_search(query="Next.js App Router Vercel AI SDK streaming response example")`
- Current events:
  - `exa_search(query="primary sources for EU AI Act enforcement updates in 2026")`
- Read a page deeply:
  - `exa_fetch(urls=["https://platform.openai.com/docs/api-reference/responses"])`

See [query patterns](references/query-patterns.md) for more examples.
