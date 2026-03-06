# n8n Smartling Community Node — Design Document

## Overview

Port the existing Zapier Smartling integration to an n8n community node package (`n8n-nodes-smartling`). The integration provides machine translation, file translation, and webhook-based event triggers using Smartling's APIs.

## Architecture

### Two Nodes

- **Smartling** (action node) — 4 operations across 3 resources
- **SmartlingTrigger** (webhook trigger node) — 17 webhook event types

### Credentials

- **SmartlingApi** — stores `userIdentifier` + `userSecret`
- No `authenticate` property; the Smartling SDK handles token lifecycle internally
- Credential test via `credentialTest` method on node class (calls `AccountsApi.searchAccounts()`)

## Node: Smartling (Actions)

### Resources and Operations

| Resource | Operation | Source (Zapier) | Description |
|----------|-----------|-----------------|-------------|
| `machineTranslation` | `translateText` | `text-mt` | Translate text via MT profiles |
| `machineTranslation` | `translateFile` | `file-mt` | File MT with poll-for-completion |
| `translation` | `requestTranslation` | `request-translation` | Upload file to daily translation job |
| `file` | `download` | `download-translated-file` | Download published translation |

### Dynamic Dropdowns (methods)

| Method | Type | Zapier Source | Used By |
|--------|------|---------------|---------|
| `searchProjects` | `listSearch` | `fetch-account-projects` | Both nodes |
| `getMtLocales` | `loadOptions` | `locales-mt` | translateText, translateFile |
| `getProjectLocales` | `loadOptions` | `project-locales` | requestTranslation, Trigger |
| `getProjectWorkflows` | `loadOptions` | `project-workflows` | requestTranslation |

### File MT: Poll-for-Completion

n8n has no native callback/resume pattern like Zapier's `performResume`. Instead:

1. Upload file via `SmartlingFileTranslationsApi.uploadFile()`
2. Detect source locale if not provided
3. Start async translation via `translateFile()`
4. Poll `getTranslationProgress()` every N seconds (default 3s)
5. Timeout after configurable duration (default 300s)
6. On completion, download translated file(s)
7. If timeout, return partial info so user can use Download operation later

User-facing fields: `Timeout (seconds)` default 300, `Poll Interval (seconds)` default 3.

### Request Translation — Conditional Fields

Uses n8n `displayOptions` to show/hide fields based on selections:
- `dailyJobNamePrefix` / `jobReferenceNumber` — shown when `dailyJobType === 'customDailyJob'`
- `targetLanguageWorkflow` — shown when `translationJobAuthorize === true`

## Node: SmartlingTrigger (Webhooks)

### Events (17 total)

Single `event` dropdown grouped by category:

| Group | Events |
|-------|--------|
| File | `file.published` |
| Source Issue | `created`, `updated`, `deleted`, `comment.created`, `comment.updated`, `comment.deleted` |
| Translation Issue | `created`, `updated`, `deleted`, `comment.created`, `comment.updated`, `comment.deleted` |
| Translation Job | `created`, `updated`, `completed`, `canceled` |

### Webhook Lifecycle

- `checkExists()` — GET webhooks from Smartling, match URL + event type
- `create()` — POST subscription via `SmartlingWebhooksApi.createSubscription()`
- `delete()` — DELETE subscription via `SmartlingWebhooksApi.deleteSubscription()`
- `webhook()` — Return payload as `workflowData`

### Additional Fields

- `projectUids` (optional) — filter webhook events by projects (same as Zapier)

## Shared Infrastructure

### Context Class (ported from Zapier)

- Generic class managing lazy-initialized API clients
- Wraps `SmartlingApiClientBuilder` with userIdentifier/userSecret
- Provides typed accessors: `getMTApi()`, `getFilesApi()`, `getWebhooksApi()`, etc.
- Includes `RemoteLogger` for structured logging to Smartling's log API

### Remote Logging

Ported from Zapier integration. `RemoteLogger` batches log entries and flushes to `SmartlingLogApi` at end of each execution. Includes structured context (accountUid, requestId, action, version).

### Error Handling

- `SmartlingException` → `NodeApiError` (preserves HTTP status for rate limits)
- Validation errors → `NodeOperationError` with `itemIndex`
- Respects `this.continueOnFail()` in execute loop

### File Handling

Ported from Zapier: file type detection, extension mapping, content retrieval (URL or binary), ZIP handling for multi-locale downloads.

## Project Structure

```
n8n-nodes-smartling/
  package.json
  tsconfig.json
  eslint.config.mjs
  jest.config.json
  credentials/
    SmartlingApi.credentials.ts
  nodes/
    Smartling/
      Smartling.node.ts
      Smartling.node.json
      SmartlingTrigger.node.ts
      SmartlingTrigger.node.json
      smartling.svg
      common/
        context.ts
        api.ts
        logger.ts
        errors.ts
        constants.ts
        transport.ts
        files/
          file-content.ts
          file-type.ts
          file-types.ts
          file-extensions.ts
        webhooks/
          event-types.ts
          webhook-payload.ts
          sample-data.ts
      actions/
        text-mt/
          execute.ts
          execute.spec.ts
          description.ts
        file-mt/
          execute.ts
          execute.spec.ts
          description.ts
        request-translation/
          execute.ts
          execute.spec.ts
          description.ts
        download-translated-file/
          execute.ts
          execute.spec.ts
          description.ts
      trigger/
        webhook-handler.ts
        webhook-handler.spec.ts
        webhook-lifecycle.ts
        webhook-lifecycle.spec.ts
      methods/
        load-options.ts
        load-options.spec.ts
        list-search.ts
        list-search.spec.ts
  test/
    mocks.ts
  dist/
```

## Dependencies

```json
{
  "dependencies": {
    "smartling-api-sdk-nodejs": "2.30.0",
    "@smartling/api-sdk-nodejs-internal": "4.3.1",
    "jszip": "3.10.1",
    "zod": "4.1.13"
  },
  "peerDependencies": {
    "n8n-workflow": "*"
  },
  "devDependencies": {
    "@n8n/node-cli": "*",
    "typescript": "~5.9.3",
    "jest": "^30.0.0",
    "ts-jest": "^30.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.0.0"
  }
}
```

Published as standard (unverified) community node since runtime dependencies are required. SDK bundling for verified status is a future follow-up.

## Testing

- Jest with mocked Smartling SDK clients (same approach as Zapier integration)
- `test/mocks.ts` provides `createContextMock()` and SDK method mocks
- Each action/trigger has co-located `.spec.ts` files
- No n8n runtime required for tests

## Future Considerations

- Bundle SDKs via esbuild/rollup to eliminate runtime dependencies for verified node status
- Additional operations as Smartling API surface expands
