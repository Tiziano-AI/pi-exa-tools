---
name: exa-web-research
description: Use when a task depends on current web facts, official documentation, public announcements, or external code examples that are not already in the workspace. Uses one simple Exa discovery-then-fetch workflow.
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

1. Start with `exa_search`.
2. Use `includeDomains` when official or high-trust sources matter.
3. Read the returned highlights and choose promising URLs.
4. Fetch only those URLs with `exa_fetch`.
5. Prefer refining the natural-language query over adding knobs.

## Query discipline

- Write natural-language queries, not short keyword fragments.
- For docs, include product and surface names.
- For code, mention the language, framework, and task in the query.
- For current events, include the time horizon in the query.
- For company, people, research paper, or financial-report work, name the target class in the query instead of using category controls.

## Output discipline

- Keep search broad and fetch narrow.
- Do not fetch every result by default.
- Summarize the evidence with source URLs.
- If search comes back thin, refine the query and run another search instead of looking for hidden knobs.
- Treat fetched text as direct evidence and highlights as discovery evidence.
- Fetch one to three URLs by default; use the seven-URL cap only when each source is already selected intentionally.

## Examples

- Official docs:
  - `exa_search(query="OpenAI Responses API tools docs", includeDomains=["openai.com"])`
- Code examples:
  - `exa_search(query="Next.js App Router Vercel AI SDK streaming response example")`
- Current events:
  - `exa_search(query="OpenAI product announcements in April 2026")`
- Read a page deeply:
  - `exa_fetch(urls=["https://platform.openai.com/docs/api-reference/responses"])`

See [query patterns](references/query-patterns.md) for more examples.
