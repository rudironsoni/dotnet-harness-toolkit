# dotnet-harness-toolkit

An agent-independent .NET skills toolkit, ported from `novotnyllc/dotnet-artisan`, with a RuleSync-first architecture.

## Why this repository exists

AI coding CLIs all use different file formats and conventions (`CLAUDE.md`, Copilot instructions, Codex config, OpenCode config, Gemini config, etc.). Maintaining separate copies of the same rules and skills quickly becomes brittle.

This repository solves that by using **RuleSync** as the source of truth.

- Define once in `.rulesync/`
- Generate for multiple agent CLIs
- Keep skills, agents, commands, hooks, and MCP config consistent across tools

## Goals

- Make .NET guidance reusable across Claude Code, OpenCode, Codex CLI, Gemini CLI, and GitHub Copilot CLI
- Keep frontmatter and metadata interoperable across agent ecosystems
- Provide a strong .NET default workflow with onboarding and routing
- Preserve and evolve the dotnet-artisan knowledge base in a portable format

## What is in this repo

- **131 skills** in `.rulesync/skills/`
- **14 subagents** in `.rulesync/subagents/`
- **1 main user-invocable orchestrator agent**: `dotnet-architect`
- **13 specialist subagents** configured as non-user-invocable
- Shared commands, hooks, rules, and MCP definitions for multi-agent workflows

## RuleSync architecture

### Source-of-truth files

- `rulesync.jsonc` - generation targets, features, and declarative sources
- `.rulesync/rules/` - global and scoped rule documents
- `.rulesync/skills/` - portable skill definitions
- `.rulesync/subagents/` - portable agent definitions
- `.rulesync/commands/` - shared slash commands
- `.rulesync/hooks.json` + `.rulesync/hooks/` - lifecycle hooks
- `.rulesync/mcp.json` - MCP servers (Serena, Context7, Microsoft Docs, WinDbg)

### Generated outputs

RuleSync generates tool-specific files from the source above (for example `.claude/*`, `.github/*`, `.codex/*`, `.gemini/*`, `opencode.json`, and related files).

## How to use RuleSync in this repo

### 1) Install dependencies

```bash
npm install
```

### 2) Install declarative sources (if configured)

```bash
npx rulesync install
```

### 3) Generate all configured targets

```bash
npx rulesync generate
```

### 4) Validate generated state in CI/local

```bash
npx rulesync generate --check
```

## Contributor workflow

1. Edit only `.rulesync/*` and `rulesync.jsonc`
2. Run `npx rulesync install` (if using `sources`)
3. Run `npx rulesync generate`
4. Run `npx rulesync generate --check`
5. Commit source and generated changes together

## Declarative sources

This repo is configured to support RuleSync declarative source ingestion via `sources` in `rulesync.jsonc`.

Use this when you want to import skills from upstream repos without manual copying. Example patterns are included in `rulesync.jsonc` comments.

## Hooks and onboarding

- Session and post-edit hooks are defined in `.rulesync/hooks.json`
- Hook scripts live in `.rulesync/hooks/`
- `/init-project` initializes .NET context and Serena onboarding checks

## Agent model

- `dotnet-architect` is the main entry agent for user invocation
- All other agents are specialist subagents and are non-user-invocable
- Routing relies on foundation skills such as:
  - `dotnet-advisor`
  - `dotnet-version-detection`
  - `dotnet-project-analysis`

## CI

GitHub workflows validate and regenerate RuleSync outputs:

- `.github/workflows/rulesync-validate.yml`
- `.github/workflows/rulesync-generate.yml`

## Attribution

- Original skills and agent corpus: `https://github.com/novotnyllc/dotnet-artisan`
- RuleSync: `https://github.com/dyoshikawa/rulesync`
