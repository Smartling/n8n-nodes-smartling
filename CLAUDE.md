# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An n8n community node package (`n8n-nodes-smartling`) that integrates Smartling's translation management platform into n8n workflows. It provides two nodes:

- **Smartling** (action node) — MT text/file translation, human translation requests, translated file downloads
- **SmartlingTrigger** (webhook node) — listens for 17 Smartling event types (file published, issues, jobs)

## Commands

```bash
npm run build        # tsc + copy SVG/JSON assets to dist/
npm run dev          # tsc --watch
npm test             # jest (all *.spec.ts files)
npm test -- --testPathPattern="file-content"  # run single test file
npm run test:coverage
npm run lint
npm run lint:fix
npm run clean        # rm -rf dist
```

## Architecture

### Two Smartling SDKs

The node uses **two** Smartling API SDKs simultaneously:
- `smartling-api-sdk-nodejs` — public SDK (files, jobs, batches, projects, webhooks, locales, MT)
- `@smartling/api-sdk-nodejs-internal` — internal SDK (file types, language detection, accounts, workflows, remote logging)

Both are accessed through the `Context` class which lazily instantiates and caches API clients.

### Context Pattern

Every operation creates a `Context` via `createContext()` in `common/context.ts`. Context holds:
- Authenticated `SmartlingApiClientBuilder` (from public SDK)
- Lazy-cached API instances (via `getApiInstance<T>()` with class-name keyed Map)
- `RemoteLogger` that batches log entries and flushes to Smartling's log API at the end of each execution

Action execute functions receive `Context` as their first parameter, keeping them decoupled from n8n's `this` binding.

### Action Structure

Each action lives in `nodes/Smartling/actions/<action-name>/`:
- `description.ts` — n8n field definitions array (spread into main node properties)
- `execute.ts` — pure business logic, takes `Context` + typed params, returns result
- `execute.spec.ts` — unit tests

The main `Smartling.node.ts` routes `resource`/`operation` combos to the appropriate execute function.

### Webhook Trigger Structure

`nodes/Smartling/trigger/`:
- `webhook-lifecycle.ts` — create/check/delete webhooks via Smartling API (stores webhook UID in static data)
- `webhook-handler.ts` — processes incoming webhook POST, extracts typed payload

### Shared Modules

`nodes/Smartling/common/`:
- `context.ts` — Context class (API client factory + logger)
- `api.ts` — SmartlingApiClientBuilder factory
- `logger.ts` — RemoteLogger (buffers log entries, flushes to Smartling log API)
- `errors.ts` — wraps SmartlingException into n8n NodeApiError/NodeOperationError, handles 423/429 retry codes
- `constants.ts` — API URL, limits, header names
- `files/` — file type detection, content type mapping, file extension mapping
- `webhooks/` — event type enum, webhook payload types, sample data

### Methods (Dynamic UI)

`nodes/Smartling/methods/`:
- `load-options.ts` — populates dropdowns (MT locales, project locales, workflows)
- `list-search.ts` — searchable project picker via `listSearch` n8n method

### Credential

`credentials/SmartlingApi.credentials.ts` — userIdentifier + userSecret authentication, with credential test that calls `searchAccounts`.

## Testing

Tests use Jest with `ts-jest`. Test files are co-located with source as `*.spec.ts`. Tests mock Smartling SDK classes — see existing specs for mock patterns. The `tsconfig.json` excludes `*.spec.ts` from compilation output.

## Build Notes

The build copies `*.svg` and `*.node.json` (codex) files from `nodes/Smartling/` to `dist/` since TypeScript doesn't handle non-TS assets. The SVG is also copied to `dist/credentials/` for the credential icon.
