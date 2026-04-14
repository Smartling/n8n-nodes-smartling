import { executeRequestTranslation, RequestTranslationParams } from "./execute";

jest.mock("../../common/smartling-api", () => ({
    smartlingRequest: jest.fn()
}));

jest.mock("../../common/files/file-type", () => ({
    detectFileType: jest.fn().mockResolvedValue("plain_text")
}));

import { smartlingRequest } from "../../common/smartling-api";
import { detectFileType } from "../../common/files/file-type";

const mockSmartlingRequest = smartlingRequest as jest.MockedFunction<typeof smartlingRequest>;

describe("executeRequestTranslation", () => {
    const context = { helpers: {} } as any;

    const baseParams: RequestTranslationParams = {
        projectUid: "project-123",
        accountUid: "account-123",
        dailyJobType: "dailyJob",
        targetLocales: ["de-DE", "fr-FR"],
        translationJobAuthorize: false,
        fileBuffer: Buffer.from("Hello World"),
        fileName: "file.txt",
        fileUri: "/test/file.txt"
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const setupDefaultMocks = (overrides?: {
        createJob?: any;
        createBatch?: any;
        uploadFile?: any;
        batchStatus?: any;
    }) => {
        const createJobResponse = overrides?.createJob ?? {
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        };
        const createBatchResponse = overrides?.createBatch ?? { batchUid: "batch-123" };
        const batchStatusResponse = overrides?.batchStatus ?? {
            files: [{ status: "COMPLETED", targetLocales: [], fileUri: "/test/file.txt" }]
        };

        mockSmartlingRequest.mockImplementation(async (_ctx, opts) => {
            // Create job
            if (opts.method === "POST" && opts.path.includes("/jobs") && !opts.path.includes("/batches")) {
                return createJobResponse;
            }
            // Create batch
            if (opts.method === "POST" && opts.path.includes("/batches") && !opts.path.includes("/file")) {
                return createBatchResponse;
            }
            // Upload batch file
            if (opts.method === "POST" && opts.path.includes("/batches/") && opts.path.includes("/file")) {
                return overrides?.uploadFile ?? {};
            }
            // Get batch status
            if (opts.method === "GET" && opts.path.includes("/batches/")) {
                return batchStatusResponse;
            }
            // Update job
            if (opts.method === "PUT" && opts.path.includes("/jobs/")) {
                return {};
            }
            // Search workflows
            if (opts.method === "POST" && opts.path.includes("/workflows")) {
                return { items: [] };
            }
            // Get project details
            if (opts.method === "GET" && opts.path.includes("/projects-api/")) {
                return { sourceLocaleId: "en-US", targetLocales: [] };
            }
            return {};
        });
    };

    test("creates daily job and uploads file successfully", async () => {
        setupDefaultMocks();

        const result = await executeRequestTranslation(context, baseParams);

        // Verify create job call
        const createJobCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/jobs") && !opts.path.includes("/batches")
        );
        expect(createJobCall).toBeDefined();
        expect(createJobCall![1].body).toEqual({
            nameTemplate: "Daily bucket job for n8n content {yyyy-MM-dd}",
            mode: "REUSE_EXISTING",
            targetLocaleIds: ["de-DE", "fr-FR"],
            timeZoneName: "UTC"
        });

        // Verify create batch call
        const createBatchCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/batches") && !opts.path.includes("/file")
        );
        expect(createBatchCall).toBeDefined();
        expect(createBatchCall![1].body).toEqual({
            translationJobUid: "job-123",
            authorize: false,
            fileUris: ["/test/file.txt"],
            localeWorkflows: []
        });

        // Verify upload batch file call
        const uploadCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/batches/") && opts.path.includes("/file")
        );
        expect(uploadCall).toBeDefined();
        expect(uploadCall![1].headers?.["Content-Type"]).toContain("multipart/form-data");

        expect(result).toEqual({
            translationJobUid: "job-123",
            translationJobName: "Daily bucket job for n8n content {yyyy-MM-dd}",
            batchUid: "batch-123",
            fileUri: "/test/file.txt",
            fileUploadStatus: "COMPLETED",
            fileUploadErrors: undefined,
            fileUploadTargetLocaleIds: [],
            translationJobCreatedDate: undefined,
            translationJobReferenceNumber: undefined,
            translationJobDescription: undefined,
            translationJobDueDate: undefined,
            translationJobTargetLocaleIds: undefined
        });
    });

    test("creates custom daily job with prefix and reference number", async () => {
        const customParams: RequestTranslationParams = {
            ...baseParams,
            dailyJobType: "customDailyJob",
            dailyJobNamePrefix: "Custom",
            jobReferenceNumber: "REF-123",
            targetLocales: ["de-DE"]
        };

        setupDefaultMocks({
            createJob: {
                translationJobUid: "job-123",
                jobName: "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}"
            }
        });

        const result = await executeRequestTranslation(context, customParams);

        // Verify create job used custom name template
        const createJobCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/jobs") && !opts.path.includes("/batches")
        );
        expect((createJobCall![1].body as any).nameTemplate).toBe(
            "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}"
        );

        // Verify update job was called with reference number
        const updateJobCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "PUT" && opts.path.includes("/jobs/")
        );
        expect(updateJobCall).toBeDefined();
        expect(updateJobCall![1].body).toEqual({
            name: "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}",
            referenceNumber: "REF-123"
        });

        expect(result.translationJobUid).toBe("job-123");
    });

    test("uses provided file type instead of auto-detecting", async () => {
        const paramsWithFileType: RequestTranslationParams = {
            ...baseParams,
            fileType: "json"
        };

        setupDefaultMocks();

        await executeRequestTranslation(context, paramsWithFileType);

        expect(detectFileType).not.toHaveBeenCalled();

        // Verify the upload contains the correct file type in multipart body
        const uploadCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/batches/") && opts.path.includes("/file")
        );
        expect(uploadCall).toBeDefined();
        const bodyStr = (uploadCall![1].body as Buffer).toString();
        expect(bodyStr).toContain("json");
    });

    test("auto-detects file type when not provided", async () => {
        setupDefaultMocks();

        await executeRequestTranslation(context, baseParams);

        expect(detectFileType).toHaveBeenCalled();
    });

    test("validates workflow when authorizing", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        mockSmartlingRequest.mockImplementation(async (_ctx, opts) => {
            // Search workflows
            if (opts.method === "POST" && opts.path.includes("/workflows")) {
                return {
                    items: [{
                        workflowUid: "workflow-123",
                        workflowName: "Test Workflow",
                        localePairs: [{ sourceLocaleId: "en-US", targetLocaleIds: ["de-DE"] }]
                    }]
                };
            }
            // Get project details
            if (opts.method === "GET" && opts.path.includes("/projects-api/")) {
                return {
                    sourceLocaleId: "en-US",
                    targetLocales: [{ localeId: "de-DE", description: "German (Germany)" }]
                };
            }
            // Create job
            if (opts.method === "POST" && opts.path.includes("/jobs") && !opts.path.includes("/batches")) {
                return { translationJobUid: "job-123", jobName: "Daily bucket job" };
            }
            // Create batch
            if (opts.method === "POST" && opts.path.includes("/batches") && !opts.path.includes("/file")) {
                return { batchUid: "batch-123" };
            }
            // Upload batch file
            if (opts.method === "POST" && opts.path.includes("/file")) {
                return {};
            }
            // Get batch status
            if (opts.method === "GET" && opts.path.includes("/batches/")) {
                return { files: [{ status: "COMPLETED", targetLocales: [], fileUri: "/test/file.txt" }] };
            }
            return {};
        });

        await executeRequestTranslation(context, authorizeParams);

        const workflowCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "POST" && opts.path.includes("/workflows")
        );
        expect(workflowCall).toBeDefined();

        const projectCall = mockSmartlingRequest.mock.calls.find(
            ([, opts]) => opts.method === "GET" && opts.path.includes("/projects-api/")
        );
        expect(projectCall).toBeDefined();
    });

    test("handles file upload failure", async () => {
        setupDefaultMocks({
            batchStatus: {
                files: [{
                    status: "ATTACH_FAILED",
                    errors: ["Upload error"],
                    targetLocales: [],
                    fileUri: "/test/file.txt"
                }]
            }
        });

        await expect(
            executeRequestTranslation(context, baseParams)
        ).rejects.toThrow(/File upload failed/);
    });

    test("throws error when workflow not found", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        mockSmartlingRequest.mockImplementation(async (_ctx, opts) => {
            if (opts.method === "POST" && opts.path.includes("/workflows")) {
                return { items: [] };
            }
            if (opts.method === "GET" && opts.path.includes("/projects-api/")) {
                return { sourceLocaleId: "en-US", targetLocales: [] };
            }
            return {};
        });

        await expect(
            executeRequestTranslation(context, authorizeParams)
        ).rejects.toThrow(/Can not retrieve information for provided workflow/);
    });

    test("throws error when workflow does not support source language", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        mockSmartlingRequest.mockImplementation(async (_ctx, opts) => {
            if (opts.method === "POST" && opts.path.includes("/workflows")) {
                return {
                    items: [{
                        workflowUid: "workflow-123",
                        workflowName: "Test Workflow",
                        localePairs: [{ sourceLocaleId: "es-ES", targetLocaleIds: ["de-DE"] }]
                    }]
                };
            }
            if (opts.method === "GET" && opts.path.includes("/projects-api/")) {
                return {
                    sourceLocaleId: "en-US",
                    targetLocales: [{ localeId: "de-DE", description: "German (Germany)" }]
                };
            }
            return {};
        });

        await expect(
            executeRequestTranslation(context, authorizeParams)
        ).rejects.toThrow(/does not support the project's source language/);
    });

    test("throws error when workflow does not support target locales", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE", "fr-FR"]
        };

        mockSmartlingRequest.mockImplementation(async (_ctx, opts) => {
            if (opts.method === "POST" && opts.path.includes("/workflows")) {
                return {
                    items: [{
                        workflowUid: "workflow-123",
                        workflowName: "Test Workflow",
                        localePairs: [{ sourceLocaleId: "en-US", targetLocaleIds: ["de-DE"] }]
                    }]
                };
            }
            if (opts.method === "GET" && opts.path.includes("/projects-api/")) {
                return {
                    sourceLocaleId: "en-US",
                    targetLocales: [
                        { localeId: "de-DE", description: "German (Germany)" },
                        { localeId: "fr-FR", description: "French (France)" }
                    ]
                };
            }
            return {};
        });

        await expect(
            executeRequestTranslation(context, authorizeParams)
        ).rejects.toThrow(/does not support the selected language\(s\): French \(France\)/);
    });

    test("handles API error gracefully", async () => {
        mockSmartlingRequest.mockRejectedValue(new Error("Job creation failed"));

        await expect(
            executeRequestTranslation(context, baseParams)
        ).rejects.toThrow("Job creation failed");
    });
});
