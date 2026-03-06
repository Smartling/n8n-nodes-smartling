import { BatchItemStatus } from "smartling-api-sdk-nodejs";
import { createContextMock } from "../../../../test/mocks";
import { Context } from "../../common/context";
import { executeRequestTranslation, RequestTranslationParams } from "./execute";

jest.mock("../../common/files/file-type", () => ({
    detectFileType: jest.fn().mockResolvedValue("plain_text")
}));

import { detectFileType } from "../../common/files/file-type";

describe("executeRequestTranslation", () => {
    let contextMock: Context;
    let jobBatchesApiMock: ReturnType<Context["getJobBatchesApi"]>;
    let jobsApiMock: ReturnType<Context["getJobsApi"]>;

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
        contextMock = createContextMock();
        jobBatchesApiMock = contextMock.getJobBatchesApi();
        jobsApiMock = contextMock.getJobsApi();
    });

    test("creates daily job and uploads file successfully", async () => {
        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{ status: BatchItemStatus.COMPLETED, targetLocales: [], fileUri: "/test/file.txt" }]
        });

        const result = await executeRequestTranslation(contextMock, baseParams);

        expect(jobBatchesApiMock.createJob).toHaveBeenCalledWith(
            "project-123",
            "Daily bucket job for n8n content {yyyy-MM-dd}",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    mode: "REUSE_EXISTING",
                    targetLocaleIds: ["de-DE", "fr-FR"],
                    timeZoneName: "UTC"
                })
            })
        );

        expect(jobBatchesApiMock.createBatch).toHaveBeenCalledWith(
            "project-123",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    translationJobUid: "job-123",
                    authorize: false,
                    fileUris: ["/test/file.txt"],
                    localeWorkflows: []
                })
            })
        );

        expect(jobBatchesApiMock.uploadBatchFile).toHaveBeenCalledWith(
            "project-123",
            "batch-123",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    fileUri: "/test/file.txt",
                    fileType: "plain_text",
                    localeIdsToAuthorize: ["de-DE", "fr-FR"]
                })
            })
        );

        expect(result).toEqual({
            translationJobUid: "job-123",
            translationJobName: "Daily bucket job for n8n content {yyyy-MM-dd}",
            fileUri: "/test/file.txt",
            fileUploadStatus: BatchItemStatus.COMPLETED,
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

        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{ status: BatchItemStatus.COMPLETED, targetLocales: [], fileUri: "/test/file.txt" }]
        });

        (jobsApiMock.updateJob as jest.Mock).mockResolvedValue({});

        const result = await executeRequestTranslation(contextMock, customParams);

        expect(jobBatchesApiMock.createJob).toHaveBeenCalledWith(
            "project-123",
            "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    mode: "REUSE_EXISTING",
                    targetLocaleIds: ["de-DE"],
                    timeZoneName: "UTC"
                })
            })
        );

        expect(jobsApiMock.updateJob).toHaveBeenCalledWith(
            "project-123",
            "job-123",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    jobName: "[Custom] Daily bucket job for n8n content {yyyy-MM-dd}",
                    referenceNumber: "REF-123"
                })
            })
        );

        expect(result.translationJobUid).toBe("job-123");
    });

    test("uses provided file type instead of auto-detecting", async () => {
        const paramsWithFileType: RequestTranslationParams = {
            ...baseParams,
            fileType: "json"
        };

        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{ status: BatchItemStatus.COMPLETED, targetLocales: [], fileUri: "/test/file.txt" }]
        });

        await executeRequestTranslation(contextMock, paramsWithFileType);

        expect(detectFileType).not.toHaveBeenCalled();

        expect(jobBatchesApiMock.uploadBatchFile).toHaveBeenCalledWith(
            "project-123",
            "batch-123",
            expect.objectContaining({
                parameters: expect.objectContaining({
                    fileType: "json"
                })
            })
        );
    });

    test("auto-detects file type when not provided", async () => {
        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{ status: BatchItemStatus.COMPLETED, targetLocales: [], fileUri: "/test/file.txt" }]
        });

        await executeRequestTranslation(contextMock, baseParams);

        expect(detectFileType).toHaveBeenCalled();
    });

    test("validates workflow when authorizing", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        const workflowsApiMock = contextMock.getWorkflowsApi();
        (workflowsApiMock.searchWorkflows as jest.Mock).mockResolvedValue({
            items: [{
                workflowUid: "workflow-123",
                workflowName: "Test Workflow",
                localePairs: [{ sourceLocaleId: "en-US", targetLocaleIds: ["de-DE"] }]
            }]
        });

        const projectsApiMock = contextMock.getProjectsApi();
        (projectsApiMock.getProjectDetails as jest.Mock).mockResolvedValue({
            sourceLocaleId: "en-US",
            targetLocales: [{ localeId: "de-DE", description: "German (Germany)" }]
        });

        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{ status: BatchItemStatus.COMPLETED, targetLocales: [], fileUri: "/test/file.txt" }]
        });

        await executeRequestTranslation(contextMock, authorizeParams);

        expect(workflowsApiMock.searchWorkflows).toHaveBeenCalled();
        expect(projectsApiMock.getProjectDetails).toHaveBeenCalled();
    });

    test("handles file upload failure", async () => {
        (jobBatchesApiMock.createJob as jest.Mock).mockResolvedValue({
            translationJobUid: "job-123",
            jobName: "Daily bucket job for n8n content {yyyy-MM-dd}"
        });

        (jobBatchesApiMock.createBatch as jest.Mock).mockResolvedValue({
            batchUid: "batch-123"
        });

        (jobBatchesApiMock.uploadBatchFile as jest.Mock).mockResolvedValue({});

        (jobBatchesApiMock.getBatchStatus as jest.Mock).mockResolvedValue({
            files: [{
                status: BatchItemStatus.ATTACH_FAILED,
                errors: ["Upload error"],
                targetLocales: [],
                fileUri: "/test/file.txt"
            }]
        });

        await expect(
            executeRequestTranslation(contextMock, baseParams)
        ).rejects.toThrow(/File upload failed/);
    });

    test("throws error when workflow not found", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        const workflowsApiMock = contextMock.getWorkflowsApi();
        const projectsApiMock = contextMock.getProjectsApi();

        (workflowsApiMock.searchWorkflows as jest.Mock).mockResolvedValue({ items: [] });
        (projectsApiMock.getProjectDetails as jest.Mock).mockResolvedValue({
            sourceLocaleId: "en-US",
            targetLocales: []
        });

        await expect(
            executeRequestTranslation(contextMock, authorizeParams)
        ).rejects.toThrow(/Can not retrieve information for provided workflow/);
    });

    test("throws error when workflow does not support source language", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE"]
        };

        const workflowsApiMock = contextMock.getWorkflowsApi();
        const projectsApiMock = contextMock.getProjectsApi();

        (workflowsApiMock.searchWorkflows as jest.Mock).mockResolvedValue({
            items: [{
                workflowUid: "workflow-123",
                workflowName: "Test Workflow",
                localePairs: [{ sourceLocaleId: "es-ES", targetLocaleIds: ["de-DE"] }]
            }]
        });

        (projectsApiMock.getProjectDetails as jest.Mock).mockResolvedValue({
            sourceLocaleId: "en-US",
            targetLocales: [{ localeId: "de-DE", description: "German (Germany)" }]
        });

        await expect(
            executeRequestTranslation(contextMock, authorizeParams)
        ).rejects.toThrow(/does not support the project's source language/);
    });

    test("throws error when workflow does not support target locales", async () => {
        const authorizeParams: RequestTranslationParams = {
            ...baseParams,
            translationJobAuthorize: true,
            targetLanguageWorkflow: "workflow-123",
            targetLocales: ["de-DE", "fr-FR"]
        };

        const workflowsApiMock = contextMock.getWorkflowsApi();
        const projectsApiMock = contextMock.getProjectsApi();

        (workflowsApiMock.searchWorkflows as jest.Mock).mockResolvedValue({
            items: [{
                workflowUid: "workflow-123",
                workflowName: "Test Workflow",
                localePairs: [{ sourceLocaleId: "en-US", targetLocaleIds: ["de-DE"] }]
            }]
        });

        (projectsApiMock.getProjectDetails as jest.Mock).mockResolvedValue({
            sourceLocaleId: "en-US",
            targetLocales: [
                { localeId: "de-DE", description: "German (Germany)" },
                { localeId: "fr-FR", description: "French (France)" }
            ]
        });

        await expect(
            executeRequestTranslation(contextMock, authorizeParams)
        ).rejects.toThrow(/does not support the selected language\(s\): French \(France\)/);
    });

    test("handles API error gracefully", async () => {
        const apiError = new Error("Job creation failed");
        (jobBatchesApiMock.createJob as jest.Mock).mockRejectedValue(apiError);

        await expect(
            executeRequestTranslation(contextMock, baseParams)
        ).rejects.toThrow("Job creation failed");
    });
});
