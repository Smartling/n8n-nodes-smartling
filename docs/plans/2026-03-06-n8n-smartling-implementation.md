# n8n Smartling Community Node — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the Zapier Smartling integration to an n8n community node package with full feature parity and test coverage.

**Architecture:** Two n8n nodes (Smartling action + SmartlingTrigger webhook) sharing common infrastructure (Context, Logger, API builder, file utilities). Uses Smartling SDKs directly — no n8n HTTP auth layer.

**Tech Stack:** TypeScript, n8n-workflow, smartling-api-sdk-nodejs, @smartling/api-sdk-nodejs-internal, jszip, zod, Jest

**Zapier source:** `/Users/fluffy/Work/Projects/n8n/zapier-integration/`
**Target:** `/Users/fluffy/Work/Projects/n8n/n8n-nodes-smartling/`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `jest.config.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create package.json**

```json
{
  "name": "n8n-nodes-smartling",
  "version": "0.1.0",
  "description": "n8n community node for Smartling translation management",
  "license": "MIT",
  "keywords": ["n8n-community-node-package"],
  "author": {
    "name": "Smartling"
  },
  "scripts": {
    "build": "tsc && gulp build:icons",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/SmartlingApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/Smartling/Smartling.node.js",
      "dist/nodes/Smartling/SmartlingTrigger.node.js"
    ]
  },
  "dependencies": {
    "smartling-api-sdk-nodejs": "^2.30.0",
    "@smartling/api-sdk-nodejs-internal": "^4.3.1",
    "jszip": "^3.10.1",
    "zod": "^4.1.13"
  },
  "peerDependencies": {
    "n8n-workflow": "*"
  },
  "devDependencies": {
    "n8n-workflow": "*",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.0.0",
    "gulp": "^5.0.0",
    "jest": "^30.0.0",
    "ts-jest": "^29.4.0",
    "typescript": "~5.9.3"
  }
}
```

> Note: We list `n8n-workflow` in both peer and dev deps. Peer for runtime, dev for compilation. The `gulp build:icons` step copies SVG files to dist — we'll create the gulpfile if needed, or simplify the build script to just use `tsc` and a copy step.

**Step 2: Create tsconfig.json**

Reference: Zapier's `tsconfig.json` at `/zapier-integration/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "es2022",
    "lib": ["es2023"],
    "outDir": "./dist",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "credentials/**/*.ts",
    "nodes/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.spec.ts"
  ]
}
```

**Step 3: Create jest.config.json**

Reference: Zapier's `jest.config.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "testEnvironment": "node",
  "roots": ["<rootDir>/nodes", "<rootDir>/credentials", "<rootDir>/test"],
  "collectCoverageFrom": ["nodes/**/*.ts", "credentials/**/*.ts"],
  "coveragePathIgnorePatterns": ["/node_modules/", "\\.spec\\.ts$", "/dist/"],
  "coverageDirectory": "./coverage",
  "coverageReporters": ["lcov", "text", "html"]
}
```

**Step 4: Create eslint.config.mjs**

```javascript
// n8n community nodes use @n8n/node-cli eslint config if available,
// but since we manage our own build, use a simple config
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    }
  },
  { ignores: ['dist/**', 'node_modules/**'] }
];
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
coverage/
test_results/
.DS_Store
*.js.map
```

**Step 6: Create .nvmrc**

Same as Zapier integration — read `/zapier-integration/.nvmrc` and use the same version.

**Step 7: Initialize git, install deps, verify build runs**

```bash
cd /Users/fluffy/Work/Projects/n8n/n8n-nodes-smartling
git init
npm install
npx tsc --noEmit  # Should succeed with no source files yet
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold n8n-nodes-smartling project"
```

---

## Task 2: Common Infrastructure — Constants, Utils, API Builder

**Files:**
- Create: `nodes/Smartling/common/constants.ts`
- Create: `nodes/Smartling/common/utils.ts`
- Create: `nodes/Smartling/common/api.ts`

**Step 1: Create constants.ts**

Port from `/zapier-integration/src/common/constants.ts`. Change platform-specific values:

```typescript
export const API_URL = "https://api.smartling.com";
export const DEFAULT_FILE_CONTENT_TYPE = "application/octet-stream";
export const ZIP_CONTENT_TYPE = "application/zip";
export const FILE_LANGUAGE_DETECTION_WAIT_TIME_MS = 500;
export const URL_DETECTION_LIMIT_CHARACTERS = 1024;
export const FILE_TYPE_DETECTION_MAX_BUFFER_SIZE = 20480;
export const REMOTE_LOGGER_HOST = "n8n";                    // Changed from "zapier.com"
export const REMOTE_LOGGER_CHANNEL = "n8n-integration";     // Changed from "zapier-integration"
export const MAX_TEXT_LENGTH_FOR_TRANSLATION = 1024 * 64;
export const MAX_TEXT_ITEMS_FOR_TRANSLATION = 1000;
export const API_CLIENT_IDENTIFIER = "n8n";                 // Changed from "zapier"
export const THROTTLED_REQUEST_DELAY_SECONDS = 120;
export const REQUEST_ID_HEADER = "x-sl-requestid";
export const DEFAULT_POLL_INTERVAL_SECONDS = 3;
export const DEFAULT_POLL_TIMEOUT_SECONDS = 300;
```

**Step 2: Create utils.ts**

Port from `/zapier-integration/src/common/utils.ts`. Keep `sleep`, `isValidURL`, `toStringArray`, `pollUntil` as-is — they have no Zapier dependencies.

**Step 3: Create api.ts**

Port from `/zapier-integration/src/common/api.ts`. Replace `Bundle` with a credentials interface:

```typescript
import { SmartlingApiClientBuilder } from "smartling-api-sdk-nodejs";
import { API_URL, API_CLIENT_IDENTIFIER } from "./constants";

export interface SmartlingCredentials {
  userIdentifier: string;
  userSecret: string;
}

export const createApiBuilder = (credentials: SmartlingCredentials, version: string) =>
  new SmartlingApiClientBuilder()
    .setBaseSmartlingApiUrl(API_URL)
    .authWithUserIdAndUserSecret(credentials.userIdentifier, credentials.userSecret)
    .setClientLibMetadata(API_CLIENT_IDENTIFIER, version);
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add common constants, utils, and API builder"
```

---

## Task 3: Common Infrastructure — Logger

**Files:**
- Create: `nodes/Smartling/common/logger.ts`
- Create: `nodes/Smartling/common/logger.spec.ts`

**Step 1: Write logger tests**

Port tests from `/zapier-integration/src/common/logger.spec.ts` if it exists, otherwise write basic tests:

```typescript
import { RemoteLogger } from "./logger";

describe("RemoteLogger", () => {
  it("should buffer log entries and flush to API", async () => {
    const logApiMock = { log: jest.fn().mockResolvedValue(undefined) };
    const logger = new RemoteLogger(logApiMock as any, "test-action", { accountUid: "acc1" }, "0.1.0");
    logger.info("test message", { key: "value" });
    await logger.flush();
    expect(logApiMock.log).toHaveBeenCalledTimes(1);
  });

  it("should not call API when buffer is empty", async () => {
    const logApiMock = { log: jest.fn() };
    const logger = new RemoteLogger(logApiMock as any, "test-action", {}, "0.1.0");
    await logger.flush();
    expect(logApiMock.log).not.toHaveBeenCalled();
  });

  it("should generate unique request IDs", () => {
    const logApiMock = { log: jest.fn() };
    const logger = new RemoteLogger(logApiMock as any, "test-action", {}, "0.1.0");
    expect(logger.getRequestId()).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="logger.spec.ts"
```

**Step 3: Implement logger.ts**

Port from `/zapier-integration/src/common/logger.ts`. Key changes:
- Remove `ZObject` / `Bundle` dependency
- Accept `SmartlingLogApi` instance directly instead of building from `SmartlingApiClientBuilder`
- Use `console.log/warn/error` instead of `z.console`
- Constructor takes: `(logApi, actionName, commonContextOverrides, version)`

```typescript
import { randomUUID } from "crypto";
import { CreateLogParameters, LogLevel, SmartlingLogApi } from "@smartling/api-sdk-nodejs-internal";
import { REMOTE_LOGGER_CHANNEL, REMOTE_LOGGER_HOST } from "./constants";

type LogContext = Record<string, unknown>;

export class RemoteLogger {
  private readonly logApi: SmartlingLogApi;
  private readonly commonContext: LogContext;
  private logBuffer: CreateLogParameters;

  constructor(logApi: SmartlingLogApi, actionName: string, contextOverrides: LogContext, version: string) {
    this.logApi = logApi;
    this.commonContext = {
      requestId: randomUUID(),
      host: REMOTE_LOGGER_HOST,
      moduleVersion: version,
      action: actionName,
      ...contextOverrides,
    };
    this.logBuffer = new CreateLogParameters();
  }

  public debug(message: string, context?: LogContext) {
    this.addLogEntry(LogLevel.DEBUG, message, context);
    console.debug(this.getMessage(message, context));
  }

  public info(message: string, context?: LogContext) {
    this.addLogEntry(LogLevel.INFO, message, context);
    console.info(this.getMessage(message, context));
  }

  public warn(message: string, context?: LogContext) {
    this.addLogEntry(LogLevel.WARNING, message, context);
    console.warn(this.getMessage(message, context));
  }

  public error(message: string, context?: LogContext) {
    this.addLogEntry(LogLevel.ERROR, message, context);
    console.error(this.getMessage(message, context));
  }

  public async flush() {
    if (Object.keys(this.logBuffer.export() ?? {}).length) {
      await this.logApi.log(this.logBuffer);
      this.logBuffer = new CreateLogParameters();
    }
  }

  public getRequestId(): string {
    return this.commonContext.requestId as string;
  }

  public setRequestId(requestId: string) {
    this.commonContext.requestId = requestId;
  }

  // Port private methods from Zapier: addLogEntry, serializeContext, getMessage
  // See /zapier-integration/src/common/logger.ts lines 50-80
  private addLogEntry(level: LogLevel, message: string, context?: LogContext) { /* ... */ }
  private serializeContext(context: LogContext): LogContext { /* ... */ }
  private getMessage(message: string, context?: LogContext): string { /* ... */ }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="logger.spec.ts"
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add RemoteLogger for Smartling log API"
```

---

## Task 4: Common Infrastructure — Context Class

**Files:**
- Create: `nodes/Smartling/common/context.ts`
- Create: `nodes/Smartling/common/context.spec.ts`

**Step 1: Write context tests**

```typescript
import { Context } from "./context";

// Mock the SDK modules
jest.mock("smartling-api-sdk-nodejs");
jest.mock("@smartling/api-sdk-nodejs-internal");

describe("Context", () => {
  it("should create API instances lazily", () => {
    const ctx = new Context(
      { userIdentifier: "uid", userSecret: "secret" },
      "test-action",
      "0.1.0"
    );
    const api1 = ctx.getMTApi();
    const api2 = ctx.getMTApi();
    expect(api1).toBe(api2); // Same cached instance
  });

  it("should provide all API accessors", () => {
    const ctx = new Context(
      { userIdentifier: "uid", userSecret: "secret" },
      "test-action",
      "0.1.0"
    );
    expect(ctx.getFileTranslationsApi()).toBeDefined();
    expect(ctx.getMTApi()).toBeDefined();
    expect(ctx.getLocalesApi()).toBeDefined();
    expect(ctx.getFilesApi()).toBeDefined();
    expect(ctx.getWebhooksApi()).toBeDefined();
    expect(ctx.getAccountsApi()).toBeDefined();
    expect(ctx.getProjectsApi()).toBeDefined();
    expect(ctx.getWorkflowsApi()).toBeDefined();
    expect(ctx.getJobsApi()).toBeDefined();
    expect(ctx.getJobBatchesApi()).toBeDefined();
    expect(ctx.getFileTypeApi()).toBeDefined();
    expect(ctx.getLanguageDetectionApi()).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement context.ts**

Port from `/zapier-integration/src/common/context.ts`. Key changes:
- Replace `ZObject`/`Bundle` with `SmartlingCredentials` interface
- Constructor: `(credentials: SmartlingCredentials, actionName: string, version: string)`
- Logger created internally using the API builder
- Remove `z` and `bundle` fields — add `credentials` instead

```typescript
import {
  SmartlingApiClientBuilder, SmartlingFileTranslationsApi,
  SmartlingMachineTranslationsApi, SmartlingLocalesApi, SmartlingFilesApi,
  SmartlingBaseApi, AccessTokenProvider, SmartlingProjectsApi,
  SmartlingWebhooksApi, SmartlingJobsApi, SmartlingJobBatchesApi,
} from "smartling-api-sdk-nodejs";
import {
  SmartlingFileTypesApi, SmartlingLanguageDetectionApi,
  SmartlingAccountsApi, SmartlingWorkflowsApi, SmartlingLogApi,
} from "@smartling/api-sdk-nodejs-internal";
import { createApiBuilder, SmartlingCredentials } from "./api";
import { RemoteLogger } from "./logger";
import { REQUEST_ID_HEADER } from "./constants";

export class Context {
  readonly logger: RemoteLogger;
  private readonly apiBuilder: SmartlingApiClientBuilder;
  private readonly apiMap = new Map<string, SmartlingBaseApi>();

  constructor(
    readonly credentials: SmartlingCredentials,
    actionName: string,
    version: string,
    logContextOverrides?: Record<string, unknown>,
  ) {
    this.apiBuilder = createApiBuilder(credentials, version);
    const logApi = this.apiBuilder.build(SmartlingLogApi) as SmartlingLogApi;
    this.logger = new RemoteLogger(logApi, actionName, logContextOverrides ?? {}, version);
    this.apiBuilder.setHttpClientConfiguration({
      headers: { [REQUEST_ID_HEADER]: this.logger.getRequestId() },
    });
  }

  // Port all get*Api() methods verbatim from Zapier Context
  // See /zapier-integration/src/common/context.ts lines 30-70
  public getFileTranslationsApi() { return this.getApiInstance(SmartlingFileTranslationsApi); }
  public getMTApi() { return this.getApiInstance(SmartlingMachineTranslationsApi); }
  public getFileTypeApi() { return this.getApiInstance(SmartlingFileTypesApi); }
  public getLocalesApi() { return this.getApiInstance(SmartlingLocalesApi); }
  public getLanguageDetectionApi() { return this.getApiInstance(SmartlingLanguageDetectionApi); }
  public getAccountsApi() { return this.getApiInstance(SmartlingAccountsApi); }
  public getFilesApi() { return this.getApiInstance(SmartlingFilesApi); }
  public getProjectsApi() { return this.getApiInstance(SmartlingProjectsApi); }
  public getWebhooksApi() { return this.getApiInstance(SmartlingWebhooksApi); }
  public getWorkflowsApi() { return this.getApiInstance(SmartlingWorkflowsApi); }
  public getJobsApi() { return this.getApiInstance(SmartlingJobsApi); }
  public getJobBatchesApi() { return this.getApiInstance(SmartlingJobBatchesApi); }

  private getApiInstance<T extends SmartlingBaseApi>(
    apiClass: new (baseUrl: string, authApi: AccessTokenProvider, logger: any) => T,
  ): T {
    if (!this.apiMap.has(apiClass.name)) {
      this.apiMap.set(apiClass.name, this.apiBuilder.build(apiClass) as T);
    }
    return this.apiMap.get(apiClass.name) as T;
  }
}

export const createContext = (
  credentials: SmartlingCredentials,
  actionName: string,
  version: string,
  logContextOverrides?: Record<string, unknown>,
) => new Context(credentials, actionName, version, logContextOverrides);
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Context class with lazy API client management"
```

---

## Task 5: Common Infrastructure — Error Handling

**Files:**
- Create: `nodes/Smartling/common/errors.ts`
- Create: `nodes/Smartling/common/errors.spec.ts`

**Step 1: Write error tests**

Test that `wrapSmartlingError` converts SDK exceptions to n8n error types.

**Step 2: Implement errors.ts**

Port from `/zapier-integration/src/common/errors.ts`. Key changes:
- Replace Zapier error types (`z.errors.ThrottledError`, `z.errors.HaltedError`) with n8n equivalents
- Use `NodeApiError` for API errors, `NodeOperationError` for validation
- Accept an n8n `INode` reference for error constructors
- Keep rate limit detection (429, 423 status codes)

```typescript
import { SmartlingException } from "smartling-api-sdk-nodejs";
import { NodeApiError, NodeOperationError } from "n8n-workflow";
import type { INode } from "n8n-workflow";
import { Context } from "./context";

const RESOURCE_LOCKED_ERROR_CODE = 423;
const MAX_OPERATIONS_LIMIT_EXCEEDED_ERROR_CODE = 429;

export const wrapAndLogError = (
  ctx: Context,
  node: INode,
  error: any,
  errorMessage: string,
  logContext?: Record<string, unknown>,
): Error => {
  if (error instanceof SmartlingException) {
    const payload = error.getPayload();
    const message = `${errorMessage} ${error.message}`;
    ctx.logger.error(message, { ...logContext, error: JSON.stringify(payload) });
    return new NodeApiError(node, error as any, { message });
  }

  ctx.logger.error(errorMessage, { ...logContext, error: JSON.stringify(error) });
  return new NodeOperationError(node, errorMessage);
};
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add error handling with Smartling exception mapping"
```

---

## Task 6: Common Infrastructure — File Utilities

**Files:**
- Create: `nodes/Smartling/common/files/file-types.ts`
- Create: `nodes/Smartling/common/files/file-extensions.ts`
- Create: `nodes/Smartling/common/files/file-type.ts`
- Create: `nodes/Smartling/common/files/file-type.spec.ts`
- Create: `nodes/Smartling/common/files/file-content.ts`
- Create: `nodes/Smartling/common/files/file-content.spec.ts`
- Create: `nodes/Smartling/common/files/index.ts`

**Step 1: Port file-types.ts and file-extensions.ts**

Copy verbatim from Zapier — these have no platform dependencies:
- `/zapier-integration/src/common/files/file-types.ts`
- `/zapier-integration/src/common/files/file-extensions.ts`

**Step 2: Port file-type.ts**

Port from `/zapier-integration/src/common/files/file-type.ts`. Key changes:
- Replace `z.request` file fetching with n8n's `this.helpers.httpRequest` or direct buffer handling
- The function receives file content (Buffer) and filename, returns detected FileType
- Uses SDK's `SmartlingFileTypesApi.indentifyFileType()` as fallback

**Step 3: Port file-content.ts**

Port from `/zapier-integration/src/common/files/file-content.ts`. Key changes:
- Replace Zapier's `z.request({ url, raw: true })` with standard `fetch()` or pass binary data directly
- In n8n, binary data comes from `this.helpers.getBinaryDataBuffer()` — the execute function will handle this and pass the buffer to the action

```typescript
import { isValidURL, URL_DETECTION_LIMIT_CHARACTERS } from "../constants";

export const getFileContent = async (
  input: string | Buffer,
  httpRequest?: (url: string) => Promise<Buffer>,
): Promise<Buffer> => {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string" && isValidURL(input)) {
    if (!httpRequest) throw new Error("HTTP request function required for URL inputs");
    return httpRequest(input);
  }
  return Buffer.from(input);
};
```

**Step 4: Write tests, port from Zapier spec files**

Port tests from:
- `/zapier-integration/src/common/files/file-type.spec.ts`
- `/zapier-integration/src/common/files/file-content.spec.ts`

Adapt mocking: replace `z.request` mocks with the `httpRequest` callback mock.

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add file type detection and content utilities"
```

---

## Task 7: Common Infrastructure — Webhook Types & Sample Data

**Files:**
- Create: `nodes/Smartling/common/webhooks/event-types.ts`
- Create: `nodes/Smartling/common/webhooks/webhook-payload.ts`
- Create: `nodes/Smartling/common/webhooks/sample-data.ts`

**Step 1: Port webhook infrastructure**

These files have no platform dependencies. Copy and adapt from:
- `/zapier-integration/src/common/webhooks/enum/event-types.ts` → `event-types.ts`
- `/zapier-integration/src/common/webhooks/interface/webhook-payload.ts` → `webhook-payload.ts`
- `/zapier-integration/src/common/webhooks/const/index.ts` → `sample-data.ts`

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add webhook event types and sample data"
```

---

## Task 8: Test Mocks

**Files:**
- Create: `test/mocks.ts`

**Step 1: Create mock utilities**

Port from `/zapier-integration/src/test/mocks.ts`. Key changes:
- Remove `ZObject`, `Bundle` mocks
- Keep all API method mocks (same structure)
- Return a mock `Context` with all API accessors returning mock objects
- Add n8n-specific mocks: mock `IExecuteFunctions`, `IHookFunctions`, `IWebhookFunctions`

```typescript
import { RemoteLogger } from "../nodes/Smartling/common/logger";
import { Context } from "../nodes/Smartling/common/context";

const getRemoteLoggerMock = (): RemoteLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  setRequestId: jest.fn(),
  getRequestId: jest.fn().mockReturnValue("test-request-id"),
}) as any as RemoteLogger;

// Port all API mocks from Zapier mocks.ts:
// getFileTranslationsApiMock, getMTApiMock, getFileTypeApiMock, etc.
// See /zapier-integration/src/test/mocks.ts lines 16-90

export const createContextMock = (overrides?: Partial<Context>): Context => {
  const fileTranslationsApiMock = getFileTranslationsApiMock();
  const mtApiMock = getMTApiMock();
  // ... all API mocks ...

  return {
    logger: getRemoteLoggerMock(),
    credentials: { userIdentifier: "test-uid", userSecret: "test-secret" },
    getFileTranslationsApi: () => fileTranslationsApiMock,
    getMTApi: () => mtApiMock,
    // ... all accessors ...
    ...overrides,
  } as unknown as Context;
};

// n8n execution context mock helper
export const createExecuteFunctionsMock = () => ({
  getCredentials: jest.fn().mockResolvedValue({
    userIdentifier: "test-uid",
    userSecret: "test-secret",
  }),
  getNodeParameter: jest.fn(),
  getInputData: jest.fn().mockReturnValue([{ json: {} }]),
  getNode: jest.fn().mockReturnValue({ name: "Smartling", type: "smartling" }),
  helpers: {
    returnJsonArray: jest.fn((data) => Array.isArray(data) ? data.map(d => ({ json: d })) : [{ json: data }]),
    httpRequest: jest.fn(),
    getBinaryDataBuffer: jest.fn(),
    prepareBinaryData: jest.fn(),
  },
  continueOnFail: jest.fn().mockReturnValue(false),
});
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add test mock utilities"
```

---

## Task 9: Credentials File

**Files:**
- Create: `credentials/SmartlingApi.credentials.ts`
- Create: `credentials/SmartlingApi.credentials.spec.ts`

**Step 1: Write credential test**

```typescript
import { SmartlingApi } from "./SmartlingApi.credentials";

describe("SmartlingApi Credentials", () => {
  it("should define required fields", () => {
    const cred = new SmartlingApi();
    expect(cred.name).toBe("smartlingApi");
    expect(cred.properties).toHaveLength(2);
    expect(cred.properties[0].name).toBe("userIdentifier");
    expect(cred.properties[1].name).toBe("userSecret");
    expect(cred.properties[1].typeOptions).toEqual({ password: true });
  });
});
```

**Step 2: Implement SmartlingApi.credentials.ts**

```typescript
import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class SmartlingApi implements ICredentialType {
  name = "smartlingApi";
  displayName = "Smartling API";
  documentationUrl = "https://help.smartling.com/hc/en-us/articles/115003028634-API";

  properties: INodeProperties[] = [
    {
      displayName: "User Identifier",
      name: "userIdentifier",
      type: "string",
      default: "",
      required: true,
      description: "API User Identifier from Smartling Dashboard > Account Settings > API",
    },
    {
      displayName: "User Secret",
      name: "userSecret",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "API Token Secret generated with the User Identifier",
    },
  ];
}
```

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Smartling API credentials"
```

---

## Task 10: Load Options & List Search Methods

**Files:**
- Create: `nodes/Smartling/methods/load-options.ts`
- Create: `nodes/Smartling/methods/load-options.spec.ts`
- Create: `nodes/Smartling/methods/list-search.ts`
- Create: `nodes/Smartling/methods/list-search.spec.ts`

**Step 1: Write load-options tests**

Test each method returns properly formatted `INodePropertyOptions[]`:

```typescript
describe("loadOptions", () => {
  describe("getMtLocales", () => {
    it("should return MT-supported locales as options", async () => { /* ... */ });
  });
  describe("getProjectLocales", () => {
    it("should return enabled project locales", async () => { /* ... */ });
    it("should require projectUid parameter", async () => { /* ... */ });
  });
  describe("getProjectWorkflows", () => {
    it("should return workflows for project", async () => { /* ... */ });
  });
});
```

**Step 2: Implement load-options.ts**

Port logic from Zapier polling triggers:
- `getMtLocales` ← `/zapier-integration/src/triggers/locales-mt/locales-mt-trigger.ts`
- `getProjectLocales` ← `/zapier-integration/src/triggers/project-locales/project-locales-trigger.ts`
- `getProjectWorkflows` ← `/zapier-integration/src/triggers/project-workflows/project-workflows-trigger.ts`

```typescript
import type { ILoadOptionsFunctions, INodePropertyOptions } from "n8n-workflow";
import { createContext } from "../common/context";
import type { SmartlingCredentials } from "../common/api";

const getCredentials = async (self: ILoadOptionsFunctions): Promise<SmartlingCredentials> => {
  const creds = await self.getCredentials("smartlingApi");
  return { userIdentifier: creds.userIdentifier as string, userSecret: creds.userSecret as string };
};

export async function getMtLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const credentials = await getCredentials(this);
  const ctx = createContext(credentials, "getMtLocales", "0.1.0");
  try {
    const localesApi = ctx.getLocalesApi();
    const locales = await localesApi.getLocales();
    return locales
      .filter((l: any) => l.mtSupported)
      .map((l: any) => ({ name: l.localeId, value: l.localeId }));
  } finally {
    await ctx.logger.flush();
  }
}

export async function getProjectLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const credentials = await getCredentials(this);
  const projectUid = this.getNodeParameter("projectUid", 0) as string;
  const ctx = createContext(credentials, "getProjectLocales", "0.1.0");
  try {
    const projectsApi = ctx.getProjectsApi();
    const project = await projectsApi.getProjectDetails(projectUid);
    return project.targetLocales
      .filter((l: any) => l.enabled)
      .map((l: any) => ({ name: `${l.description} (${l.localeId})`, value: l.localeId }));
  } finally {
    await ctx.logger.flush();
  }
}

export async function getProjectWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  // Port from /zapier-integration/src/triggers/project-workflows/project-workflows-trigger.ts
  // Uses ctx.getWorkflowsApi().searchWorkflows()
}
```

**Step 3: Write list-search tests**

```typescript
describe("listSearch", () => {
  describe("searchProjects", () => {
    it("should return paginated project results", async () => { /* ... */ });
    it("should filter by search term", async () => { /* ... */ });
  });
});
```

**Step 4: Implement list-search.ts**

Port from `/zapier-integration/src/triggers/fetch-account-projects/fetch-account-projects-trigger.ts`:

```typescript
import type { ILoadOptionsFunctions, INodeListSearchResult } from "n8n-workflow";

export async function searchProjects(
  this: ILoadOptionsFunctions,
  filter?: string,
  paginationToken?: string,
): Promise<INodeListSearchResult> {
  // Create context, call projectsApi.listProjects() with pagination
  // Filter by name if filter provided
  // Return { results: [...], paginationToken: nextOffset }
}
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add loadOptions and listSearch methods for dynamic dropdowns"
```

---

## Task 11: Action — Text Machine Translation

**Files:**
- Create: `nodes/Smartling/actions/text-mt/description.ts`
- Create: `nodes/Smartling/actions/text-mt/execute.ts`
- Create: `nodes/Smartling/actions/text-mt/execute.spec.ts`

**Step 1: Create description.ts**

Define n8n `INodeProperties[]` for the translateText operation. Port input fields from `/zapier-integration/src/actions/text-mt/text-mt-fields.ts`:

```typescript
import type { INodeProperties } from "n8n-workflow";

export const textMtFields: INodeProperties[] = [
  {
    displayName: "Source Locale",
    name: "sourceLocale",
    type: "options",
    typeOptions: { loadOptionsMethod: "getMtLocales" },
    default: "",
    description: "Source language. Auto-detected if not specified.",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateText"] } },
  },
  {
    displayName: "Target Locale",
    name: "targetLocale",
    type: "options",
    typeOptions: { loadOptionsMethod: "getMtLocales" },
    required: true,
    default: "",
    description: "Target language for translation",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateText"] } },
  },
  {
    displayName: "Source Text",
    name: "sourceText",
    type: "string",
    typeOptions: { rows: 4 },
    required: true,
    default: "",
    description: "Text to translate. For multiple strings, separate with newlines.",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateText"] } },
  },
];
```

**Step 2: Write execute tests**

Port from `/zapier-integration/src/actions/text-mt/text-mt-action.spec.ts`. Adapt:
- Replace `createAppTester` + Zapier mocks with direct function call + n8n mock context
- Mock `createContext` to return mock
- Assert same behavior: locale detection, API calls, output format

Key test cases to port:
- Single text translation
- Multiple texts (newline-separated)
- Source locale auto-detection
- Input size validation (max 64KB, max 1000 items)
- Logger flush

**Step 3: Implement execute.ts**

Port from `/zapier-integration/src/actions/text-mt/text-mt-action.ts`. Key changes:
- Function signature: `(ctx: Context, sourceLocale: string, targetLocale: string, sourceText: string) => Promise<object>`
- Replace `bundle.inputData.*` with function parameters
- Replace `z.errors.HaltedError` with thrown `NodeOperationError`
- Keep the core logic: validate input → detect locale → call `ctx.getMTApi().translate()` → format output

```typescript
import { Context } from "../../common/context";
import { SmartlingMTParameters } from "smartling-api-sdk-nodejs";
import { MAX_TEXT_LENGTH_FOR_TRANSLATION, MAX_TEXT_ITEMS_FOR_TRANSLATION } from "../../common/constants";

export const executeTextMt = async (
  ctx: Context,
  sourceLocale: string | undefined,
  targetLocale: string,
  sourceText: string,
): Promise<Record<string, unknown>> => {
  // 1. Parse input text (split by newlines for multiple strings)
  // 2. Validate constraints (max items, max length)
  // 3. Detect source locale if not provided (via language detection API)
  // 4. Call ctx.getMTApi().translate() with SmartlingMTParameters
  // 5. Format output: { sourceLocaleId, targetLocaleId, source: {...}, translated: {...} }
  // Port logic from /zapier-integration/src/actions/text-mt/text-mt-action.ts
};
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Text Machine Translation action"
```

---

## Task 12: Action — File Machine Translation

**Files:**
- Create: `nodes/Smartling/actions/file-mt/description.ts`
- Create: `nodes/Smartling/actions/file-mt/execute.ts`
- Create: `nodes/Smartling/actions/file-mt/execute.spec.ts`

**Step 1: Create description.ts**

Port fields from `/zapier-integration/src/actions/file-mt/file-mt-fields.ts`. Add n8n-specific fields:
- File input as binary property reference
- Target locales as multi-select with loadOptions
- Timeout and poll interval fields

```typescript
export const fileMtFields: INodeProperties[] = [
  {
    displayName: "Binary Property",
    name: "binaryPropertyName",
    type: "string",
    default: "data",
    required: true,
    description: "Name of the binary property containing the file to translate",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
  {
    displayName: "File Type",
    name: "fileType",
    type: "options",
    options: [
      { name: "Auto-Detect", value: "" },
      // Port MT-supported file types from Zapier fields
    ],
    default: "",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
  {
    displayName: "Source Locale",
    name: "sourceLocale",
    type: "options",
    typeOptions: { loadOptionsMethod: "getMtLocales" },
    default: "",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
  {
    displayName: "Target Locales",
    name: "targetLocales",
    type: "multiOptions",
    typeOptions: { loadOptionsMethod: "getMtLocales" },
    required: true,
    default: [],
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
  {
    displayName: "Timeout (Seconds)",
    name: "timeout",
    type: "number",
    default: 300,
    description: "Maximum time to wait for translation completion",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
  {
    displayName: "Poll Interval (Seconds)",
    name: "pollInterval",
    type: "number",
    default: 3,
    description: "How often to check translation progress",
    displayOptions: { show: { resource: ["machineTranslation"], operation: ["translateFile"] } },
  },
];
```

**Step 2: Write execute tests**

Port from `/zapier-integration/src/actions/file-mt/file-mt-action.spec.ts` and related spec files. Key test cases:
- File upload + translate + poll + download flow
- Source locale auto-detection
- File type auto-detection
- Poll timeout behavior (returns partial info)
- Multiple target locales (ZIP download)
- Single target locale (direct download)

**Step 3: Implement execute.ts**

Port and merge logic from multiple Zapier files:
- `/zapier-integration/src/actions/file-mt/file-mt-action.ts` (main flow)
- `/zapier-integration/src/actions/file-mt/file-mt-upload.ts` (upload step)
- `/zapier-integration/src/actions/file-mt/file-mt-source-locale.ts` (locale detection)
- `/zapier-integration/src/actions/file-mt/file-mt-translate.ts` (translation step)
- `/zapier-integration/src/actions/file-mt/file-mt-callback.ts` (download step)

Key changes from Zapier:
- Replace `performResume` callback pattern with `pollUntil` from `utils.ts`
- After `translateFile()`, poll `getTranslationProgress()` using `pollUntil`
- On completion, download file(s) and return as n8n binary data
- On timeout, return metadata with status info

```typescript
import { Context } from "../../common/context";
import { pollUntil } from "../../common/utils";
import { detectFileType } from "../../common/files/file-type";
import { DEFAULT_POLL_INTERVAL_SECONDS, DEFAULT_POLL_TIMEOUT_SECONDS } from "../../common/constants";

export const executeFileMt = async (
  ctx: Context,
  fileBuffer: Buffer,
  fileName: string,
  fileType: string | undefined,
  sourceLocale: string | undefined,
  targetLocales: string[],
  timeout: number = DEFAULT_POLL_TIMEOUT_SECONDS,
  pollInterval: number = DEFAULT_POLL_INTERVAL_SECONDS,
): Promise<{ binary?: Buffer; metadata: Record<string, unknown> }> => {
  // 1. Detect file type if not provided
  // 2. Upload file: ctx.getFileTranslationsApi().uploadFile()
  // 3. Detect source locale if not provided
  // 4. Start translation: ctx.getFileTranslationsApi().translateFile()
  // 5. Poll for completion using pollUntil:
  //    pollUntil(() => ctx.getFileTranslationsApi().getTranslationProgress(...), {
  //      delayBetweenAttempts: pollInterval * 1000,
  //      maxDuration: timeout * 1000,
  //      exitCondition: (result) => result.completed,
  //      returnLastOnTimeout: true,
  //    })
  // 6. Download translated file(s)
  // 7. Return binary data + metadata
};
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add File Machine Translation action with poll-for-completion"
```

---

## Task 13: Action — Download Translated File

**Files:**
- Create: `nodes/Smartling/actions/download-translated-file/description.ts`
- Create: `nodes/Smartling/actions/download-translated-file/execute.ts`
- Create: `nodes/Smartling/actions/download-translated-file/execute.spec.ts`

**Step 1: Create description.ts**

Port from `/zapier-integration/src/actions/download-translated-file/download-translated-file-fields.ts`:

```typescript
export const downloadTranslatedFileFields: INodeProperties[] = [
  {
    displayName: "Project",
    name: "projectUid",
    type: "resourceLocator",
    default: { mode: "list", value: "" },
    required: true,
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        typeOptions: { searchListMethod: "searchProjects", searchable: true },
      },
      { displayName: "By ID", name: "id", type: "string" },
    ],
    displayOptions: { show: { resource: ["file"], operation: ["download"] } },
  },
  {
    displayName: "File URI",
    name: "fileUri",
    type: "string",
    required: true,
    default: "",
    displayOptions: { show: { resource: ["file"], operation: ["download"] } },
  },
  {
    displayName: "Target Locale",
    name: "targetLocale",
    type: "options",
    typeOptions: { loadOptionsMethod: "getProjectLocales" },
    required: true,
    default: "",
    displayOptions: { show: { resource: ["file"], operation: ["download"] } },
  },
  {
    displayName: "Retrieval Type",
    name: "retrievalType",
    type: "options",
    options: [
      { name: "Published", value: "published" },
      { name: "Approved", value: "approved" },
      { name: "Pending", value: "pending" },
      { name: "In Context Review", value: "contextMatchingInstrumented" },
    ],
    default: "published",
    displayOptions: { show: { resource: ["file"], operation: ["download"] } },
  },
  {
    displayName: "Include Original Strings",
    name: "includeOriginalStrings",
    type: "boolean",
    default: false,
    displayOptions: { show: { resource: ["file"], operation: ["download"] } },
  },
];
```

**Step 2: Write execute tests**

Port from `/zapier-integration/src/actions/download-translated-file/download-translated-file-action.spec.ts`.

**Step 3: Implement execute.ts**

Port from `/zapier-integration/src/actions/download-translated-file/download-translated-file-action.ts`:

```typescript
export const executeDownloadTranslatedFile = async (
  ctx: Context,
  projectUid: string,
  fileUri: string,
  targetLocale: string,
  retrievalType?: string,
  includeOriginalStrings?: boolean,
): Promise<{ binary: Buffer; fileName: string; mimeType: string }> => {
  // 1. Build DownloadFileWithMetadataParameters
  // 2. Call ctx.getFilesApi().downloadFileWithMetadata()
  // 3. Return file buffer + metadata
};
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Download Translated File action"
```

---

## Task 14: Action — Request Translation

**Files:**
- Create: `nodes/Smartling/actions/request-translation/description.ts`
- Create: `nodes/Smartling/actions/request-translation/execute.ts`
- Create: `nodes/Smartling/actions/request-translation/execute.spec.ts`
- Create: `nodes/Smartling/actions/request-translation/job-service.ts`
- Create: `nodes/Smartling/actions/request-translation/workflow-validator.ts`

**Step 1: Create description.ts**

Port from `/zapier-integration/src/actions/request-translation/request-translation-fields.ts`. This has the most complex field definitions with conditional display:

Key fields with `displayOptions`:
- `projectUid` — resourceLocator with searchProjects
- `dailyJobType` — "dailyJob" or "customDailyJob"
- `dailyJobNamePrefix` — shown when `dailyJobType === "customDailyJob"`
- `jobReferenceNumber` — shown when `dailyJobType === "customDailyJob"`
- `targetLocales` — multiOptions with getProjectLocales
- `translationJobAuthorize` — boolean
- `targetLanguageWorkflow` — shown when `translationJobAuthorize === true`
- `binaryPropertyName` — file input
- `fileUri` — string
- `fileType` — options with auto-detect

**Step 2: Port job-service.ts and workflow-validator.ts**

Port from:
- `/zapier-integration/src/actions/request-translation/job-service.ts`
- `/zapier-integration/src/actions/request-translation/workflow-validator.ts`

These have no platform dependencies beyond Context — port directly.

**Step 3: Write execute tests**

Port from `/zapier-integration/src/actions/request-translation/request-translation-action.spec.ts`. Key test cases:
- Standard daily job creation
- Custom daily job with prefix
- File upload and batch processing
- Workflow validation when authorizing
- Batch status polling
- Error handling

**Step 4: Implement execute.ts**

Port from `/zapier-integration/src/actions/request-translation/request-translation-action.ts`:

```typescript
export const executeRequestTranslation = async (
  ctx: Context,
  params: RequestTranslationParams,
): Promise<Record<string, unknown>> => {
  // 1. Validate input with Zod schema
  // 2. Detect/validate workflow if authorizing
  // 3. Get file content from buffer
  // 4. Detect file type if not provided
  // 5. Create or reuse daily job via job-service
  // 6. Add file to job via batch
  // 7. Poll batch status
  // 8. Return job details + file upload results
};
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Request Translation action"
```

---

## Task 15: Smartling Action Node — Main File

**Files:**
- Create: `nodes/Smartling/Smartling.node.ts`
- Create: `nodes/Smartling/Smartling.node.json`

**Step 1: Create Smartling.node.ts**

Wire everything together:

```typescript
import type {
  IExecuteFunctions, INodeExecutionData, INodeType,
  INodeTypeDescription, ICredentialTestFunctions,
  INodeCredentialTestResult, ICredentialsDecrypted,
  ILoadOptionsFunctions, INodePropertyOptions, INodeListSearchResult,
} from "n8n-workflow";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";
import { createContext } from "./common/context";
import { wrapAndLogError } from "./common/errors";
import { executeTextMt } from "./actions/text-mt/execute";
import { executeFileMt } from "./actions/file-mt/execute";
import { executeDownloadTranslatedFile } from "./actions/download-translated-file/execute";
import { executeRequestTranslation } from "./actions/request-translation/execute";
import { textMtFields } from "./actions/text-mt/description";
import { fileMtFields } from "./actions/file-mt/description";
import { downloadTranslatedFileFields } from "./actions/download-translated-file/description";
import { requestTranslationFields } from "./actions/request-translation/description";
import { getMtLocales, getProjectLocales, getProjectWorkflows } from "./methods/load-options";
import { searchProjects } from "./methods/list-search";

export class Smartling implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Smartling",
    name: "smartling",
    icon: "file:smartling.svg",
    group: ["input"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Interact with Smartling translation management",
    defaults: { name: "Smartling" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "smartlingApi", required: true }],
    properties: [
      // Resource selector
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Machine Translation", value: "machineTranslation" },
          { name: "Translation", value: "translation" },
          { name: "File", value: "file" },
        ],
        default: "machineTranslation",
      },
      // Operation selectors (one per resource with displayOptions)
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["machineTranslation"] } },
        options: [
          { name: "Translate Text", value: "translateText", action: "Translate text using MT" },
          { name: "Translate File", value: "translateFile", action: "Translate file using MT" },
        ],
        default: "translateText",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["translation"] } },
        options: [
          { name: "Request Translation", value: "requestTranslation", action: "Request file translation" },
        ],
        default: "requestTranslation",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["file"] } },
        options: [
          { name: "Download", value: "download", action: "Download translated file" },
        ],
        default: "download",
      },
      // All field definitions
      ...textMtFields,
      ...fileMtFields,
      ...downloadTranslatedFileFields,
      ...requestTranslationFields,
    ],
  };

  methods = {
    credentialTest: {
      async smartlingApiTest(
        this: ICredentialTestFunctions,
        credential: ICredentialsDecrypted,
      ): Promise<INodeCredentialTestResult> {
        try {
          const creds = credential.data!;
          const ctx = createContext(
            { userIdentifier: creds.userIdentifier as string, userSecret: creds.userSecret as string },
            "credentialTest", "0.1.0",
          );
          const accountsApi = ctx.getAccountsApi();
          const { SearchAccountsParameters } = await import("@smartling/api-sdk-nodejs-internal");
          const params = new SearchAccountsParameters().setLimit(1);
          const result = await accountsApi.searchAccounts(params);
          if (!result.accounts.length) {
            return { status: "Error", message: "No account found for these credentials" };
          }
          return { status: "OK", message: `Connected to ${result.accounts[0].accountName}` };
        } catch (error) {
          return { status: "Error", message: `Authentication failed: ${(error as Error).message}` };
        }
      },
    },
    loadOptions: { getMtLocales, getProjectLocales, getProjectWorkflows },
    listSearch: { searchProjects },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const credentials = await this.getCredentials("smartlingApi");
        const ctx = createContext(
          { userIdentifier: credentials.userIdentifier as string, userSecret: credentials.userSecret as string },
          `${resource}.${operation}`, "0.1.0",
        );

        try {
          if (resource === "machineTranslation" && operation === "translateText") {
            const result = await executeTextMt(
              ctx,
              this.getNodeParameter("sourceLocale", i) as string || undefined,
              this.getNodeParameter("targetLocale", i) as string,
              this.getNodeParameter("sourceText", i) as string,
            );
            returnData.push({ json: result, pairedItem: i });
          }
          else if (resource === "machineTranslation" && operation === "translateFile") {
            const binaryProp = this.getNodeParameter("binaryPropertyName", i) as string;
            const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
            const binaryData = items[i].binary?.[binaryProp];
            const fileName = binaryData?.fileName ?? "file";
            const result = await executeFileMt(
              ctx, fileBuffer, fileName,
              this.getNodeParameter("fileType", i) as string || undefined,
              this.getNodeParameter("sourceLocale", i) as string || undefined,
              this.getNodeParameter("targetLocales", i) as string[],
              this.getNodeParameter("timeout", i) as number,
              this.getNodeParameter("pollInterval", i) as number,
            );
            if (result.binary) {
              const binaryOutput = await this.helpers.prepareBinaryData(
                result.binary, result.metadata.fileName as string,
              );
              returnData.push({ json: result.metadata, binary: { data: binaryOutput }, pairedItem: i });
            } else {
              returnData.push({ json: result.metadata, pairedItem: i });
            }
          }
          else if (resource === "file" && operation === "download") {
            // Call executeDownloadTranslatedFile, return binary
          }
          else if (resource === "translation" && operation === "requestTranslation") {
            // Call executeRequestTranslation, return json
          }
        } finally {
          await ctx.logger.flush();
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }
}
```

**Step 2: Create Smartling.node.json (codex)**

```json
{
  "node": "n8n-nodes-smartling.smartling",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Productivity"],
  "resources": {
    "primaryDocumentation": [
      { "url": "https://help.smartling.com/hc/en-us/articles/115003028634-API" }
    ]
  }
}
```

**Step 3: Create placeholder smartling.svg icon**

A simple placeholder SVG. Replace with actual Smartling logo later.

**Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Smartling action node with all operations"
```

---

## Task 16: Webhook Trigger — Lifecycle & Handler

**Files:**
- Create: `nodes/Smartling/trigger/webhook-lifecycle.ts`
- Create: `nodes/Smartling/trigger/webhook-lifecycle.spec.ts`
- Create: `nodes/Smartling/trigger/webhook-handler.ts`
- Create: `nodes/Smartling/trigger/webhook-handler.spec.ts`

**Step 1: Write lifecycle tests**

Port from Zapier webhook function specs. Test:
- `checkExists`: finds matching webhook, returns true
- `checkExists`: no match, returns false
- `create`: creates subscription, stores ID in static data
- `delete`: deletes subscription, cleans up static data

**Step 2: Implement webhook-lifecycle.ts**

Port from Zapier webhook functions:
- `/zapier-integration/src/common/webhooks/functions/get-perform-subscribe-handler.ts`
- `/zapier-integration/src/common/webhooks/functions/get-perform-unsubscribe-handler.ts`

```typescript
import type { IHookFunctions } from "n8n-workflow";
import { createContext } from "../common/context";

export async function checkExists(this: IHookFunctions, eventType: string): Promise<boolean> {
  const credentials = await this.getCredentials("smartlingApi");
  const ctx = createContext(
    { userIdentifier: credentials.userIdentifier as string, userSecret: credentials.userSecret as string },
    "webhook.checkExists", "0.1.0",
  );
  try {
    const webhookUrl = this.getNodeWebhookUrl("default");
    const webhooksApi = ctx.getWebhooksApi();
    const subscriptions = await webhooksApi.getSubscriptions();
    const existing = subscriptions.find(
      (s: any) => s.callbackUrl === webhookUrl && s.eventType === eventType,
    );
    if (existing) {
      this.getWorkflowStaticData("node").webhookId = existing.webhookUid;
      return true;
    }
    return false;
  } finally {
    await ctx.logger.flush();
  }
}

export async function create(this: IHookFunctions, eventType: string, projectUids?: string[]): Promise<boolean> {
  // Create webhook subscription via SmartlingWebhooksApi.createSubscription()
  // Store webhookId in this.getWorkflowStaticData("node")
}

export async function remove(this: IHookFunctions): Promise<boolean> {
  // Delete webhook subscription via SmartlingWebhooksApi.deleteSubscription()
  // Clean up static data
}
```

**Step 3: Implement webhook-handler.ts**

```typescript
import type { IWebhookFunctions, IWebhookResponseData } from "n8n-workflow";

export async function handleWebhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  const bodyData = this.getBodyData();
  return {
    workflowData: [this.helpers.returnJsonArray(bodyData)],
  };
}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add webhook lifecycle management and handler"
```

---

## Task 17: SmartlingTrigger Node — Main File

**Files:**
- Create: `nodes/Smartling/SmartlingTrigger.node.ts`
- Create: `nodes/Smartling/SmartlingTrigger.node.json`

**Step 1: Create SmartlingTrigger.node.ts**

```typescript
import type {
  IHookFunctions, IWebhookFunctions, INodeType,
  INodeTypeDescription, IWebhookResponseData,
  ILoadOptionsFunctions, INodePropertyOptions, INodeListSearchResult,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";
import { EventTypes } from "./common/webhooks/event-types";
import { checkExists, create, remove } from "./trigger/webhook-lifecycle";
import { handleWebhook } from "./trigger/webhook-handler";
import { getMtLocales, getProjectLocales } from "./methods/load-options";
import { searchProjects } from "./methods/list-search";

export class SmartlingTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Smartling Trigger",
    name: "smartlingTrigger",
    icon: "file:smartling.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description: "Triggers workflow on Smartling events",
    defaults: { name: "Smartling Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "smartlingApi", required: true }],
    webhooks: [
      { name: "default", httpMethod: "POST", responseMode: "onReceived", path: "webhook" },
    ],
    properties: [
      {
        displayName: "Event",
        name: "event",
        type: "options",
        required: true,
        default: "file.published",
        options: [
          { name: "File Published", value: EventTypes.FILE_PUBLISHED },
          // Source Issue events
          { name: "Source Issue Created", value: EventTypes.SOURCE_ISSUE_CREATED },
          { name: "Source Issue Updated", value: EventTypes.SOURCE_ISSUE_UPDATED },
          { name: "Source Issue Deleted", value: EventTypes.SOURCE_ISSUE_DELETED },
          { name: "Source Issue Comment Created", value: EventTypes.SOURCE_ISSUE_COMMENT_CREATED },
          { name: "Source Issue Comment Updated", value: EventTypes.SOURCE_ISSUE_COMMENT_UPDATED },
          { name: "Source Issue Comment Deleted", value: EventTypes.SOURCE_ISSUE_COMMENT_DELETED },
          // Translation Issue events
          { name: "Translation Issue Created", value: EventTypes.TRANSLATION_ISSUE_CREATED },
          { name: "Translation Issue Updated", value: EventTypes.TRANSLATION_ISSUE_UPDATED },
          { name: "Translation Issue Deleted", value: EventTypes.TRANSLATION_ISSUE_DELETED },
          { name: "Translation Issue Comment Created", value: EventTypes.TRANSLATION_ISSUE_COMMENT_CREATED },
          { name: "Translation Issue Comment Updated", value: EventTypes.TRANSLATION_ISSUE_COMMENT_UPDATED },
          { name: "Translation Issue Comment Deleted", value: EventTypes.TRANSLATION_ISSUE_COMMENT_DELETED },
          // Translation Job events
          { name: "Translation Job Created", value: EventTypes.TRANSLATION_JOB_CREATED },
          { name: "Translation Job Updated", value: EventTypes.TRANSLATION_JOB_UPDATED },
          { name: "Translation Job Completed", value: EventTypes.TRANSLATION_JOB_COMPLETED },
          { name: "Translation Job Canceled", value: EventTypes.TRANSLATION_JOB_CANCELED },
        ],
      },
      {
        displayName: "Filter by Projects",
        name: "projectUids",
        type: "multiOptions",
        typeOptions: { loadOptionsMethod: "getProjectLocales" },
        default: [],
        description: "Optionally filter events to specific projects",
      },
    ],
  };

  methods = {
    loadOptions: { getMtLocales, getProjectLocales },
    listSearch: { searchProjects },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const event = this.getNodeParameter("event") as string;
        return checkExists.call(this, event);
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const event = this.getNodeParameter("event") as string;
        const projectUids = this.getNodeParameter("projectUids", []) as string[];
        return create.call(this, event, projectUids.length ? projectUids : undefined);
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        return remove.call(this);
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    return handleWebhook.call(this);
  }
}
```

**Step 2: Create SmartlingTrigger.node.json**

```json
{
  "node": "n8n-nodes-smartling.smartlingTrigger",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Productivity"],
  "resources": {
    "primaryDocumentation": [
      { "url": "https://help.smartling.com/hc/en-us/articles/115003028634-API" }
    ]
  }
}
```

**Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add SmartlingTrigger webhook node with 17 event types"
```

---

## Task 18: Build Verification & Linting

**Step 1: Run full build**

```bash
cd /Users/fluffy/Work/Projects/n8n/n8n-nodes-smartling
npm run build
```

Verify `dist/` contains compiled JS for all nodes and credentials.

**Step 2: Run all tests**

```bash
npm test
```

All tests should pass.

**Step 3: Run tests with coverage**

```bash
npm run test:coverage
```

Review coverage report — aim for similar coverage to Zapier integration.

**Step 4: Run linting**

```bash
npm run lint
```

Fix any issues.

**Step 5: Verify n8n field registration**

Check that `package.json` `n8n` field points to correct compiled files:
- `dist/credentials/SmartlingApi.credentials.js` exists
- `dist/nodes/Smartling/Smartling.node.js` exists
- `dist/nodes/Smartling/SmartlingTrigger.node.js` exists

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix build and lint issues"
```

---

## Task 19: Local Testing with n8n

**Step 1: Link the package for local testing**

```bash
cd /Users/fluffy/Work/Projects/n8n/n8n-nodes-smartling
npm link

# In your n8n installation directory:
npm link n8n-nodes-smartling
```

**Step 2: Start n8n and verify**

```bash
n8n start
```

Verify in the n8n UI:
- "Smartling" action node appears in the node picker
- "Smartling Trigger" trigger node appears
- Credentials dialog shows User Identifier and User Secret fields
- "Test" button validates credentials
- Dynamic dropdowns load options (projects, locales, workflows)
- Each operation shows correct fields

**Step 3: Test a workflow end-to-end (manual)**

Create a simple workflow: Smartling → translate text → output. Verify it works with real Smartling credentials.

---

## Summary: Task Dependencies

```
Task 1 (Scaffolding)
  └── Task 2 (Constants, Utils, API)
       └── Task 3 (Logger)
            └── Task 4 (Context)
                 └── Task 5 (Errors)
                      ├── Task 6 (File Utils)
                      ├── Task 7 (Webhook Types)
                      └── Task 8 (Test Mocks)
                           ├── Task 9 (Credentials)
                           ├── Task 10 (Load Options / List Search)
                           ├── Task 11 (Text MT Action)
                           ├── Task 12 (File MT Action)
                           ├── Task 13 (Download Action)
                           ├── Task 14 (Request Translation Action)
                           ├── Task 15 (Smartling Node)
                           ├── Task 16 (Webhook Lifecycle)
                           └── Task 17 (SmartlingTrigger Node)
                                └── Task 18 (Build Verification)
                                     └── Task 19 (Local Testing)
```

Tasks 9-17 can be done in parallel after Task 8 is complete, except Task 15 depends on 11-14 and Task 17 depends on 16.
