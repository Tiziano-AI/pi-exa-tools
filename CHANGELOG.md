# Changelog

## 0.3.0 - 2026-05-03

- Added lower-only Exa output preview controls with `PI_EXA_TOOLS_PREVIEW_LINES` and `PI_EXA_TOOLS_PREVIEW_BYTES`.
- Saved over-preview Exa output to a temp file with concise `read` guidance for omitted content.
- Surfaced effective preview limits in `/exa status`, `/exa settings`, tool descriptions, README, and the companion skill.
- Added deterministic coverage for default, lowered, invalid, capped, and tiny-preview behavior.

Credit: this release was prompted by PR #1 from [ppowo](https://github.com/ppowo).
