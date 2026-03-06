import { IExecuteFunctions, IHookFunctions, IWebhookFunctions } from "n8n-workflow";
import { RemoteLogger } from "../nodes/Smartling/common/logger";
import { Context } from "../nodes/Smartling/common/context";

const getRemoteLoggerMock = (): RemoteLogger => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    flush: jest.fn(),
    setRequestId: jest.fn(),
    getRequestId: jest.fn().mockReturnValue("test-request-id")
}) as any as RemoteLogger;

const getFileTranslationsApiMock = () => ({
    uploadFile: jest.fn(),
    translateFile: jest.fn(),
    getTranslationProgress: jest.fn(),
    downloadTranslatedFile: jest.fn(),
    downloadTranslatedFileWithMetadata: jest.fn(),
    downloadTranslatedFiles: jest.fn(),
    downloadTranslatedFilesWithMetadata: jest.fn(),
    cancelFileTranslation: jest.fn(),
    detectFileLanguage: jest.fn(),
    getLanguageDetectionProgress: jest.fn()
});

const getMTApiMock = () => ({
    translate: jest.fn()
});

const getFileTypeApiMock = () => ({
    indentifyFileType: jest.fn()
});

const getLocalesApiMock = () => ({
    getLocales: jest.fn()
});

const getLanguageDetectionApiMock = () => ({
    detectLanguage: jest.fn()
});

const getAccountsApiMock = () => ({
    searchAccounts: jest.fn()
});

const getFilesApiMock = () => ({
    downloadFile: jest.fn(),
    downloadFileWithMetadata: jest.fn()
});

const getProjectsApiMock = () => ({
    listProjects: jest.fn(),
    getProjectDetails: jest.fn()
});

const getWebhooksApiMock = () => ({
    getSubscriptions: jest.fn(),
    createSubscription: jest.fn(),
    deleteSubscription: jest.fn()
});

const getWorkflowsApiMock = () => ({
    searchWorkflows: jest.fn()
});

const getJobBatchesApiMock = () => ({
    createJob: jest.fn(),
    createBatch: jest.fn(),
    uploadBatchFile: jest.fn(),
    getBatchStatus: jest.fn()
});

const getJobsApiMock = () => ({
    updateJob: jest.fn()
});

export const createContextMock = (overrides?: Partial<Context>): Context => {
    const fileTranslationsApiMock = getFileTranslationsApiMock();
    const mtApiMock = getMTApiMock();
    const fileTypeApiMock = getFileTypeApiMock();
    const localesApiMock = getLocalesApiMock();
    const languageDetectionApiMock = getLanguageDetectionApiMock();
    const accountsApiMock = getAccountsApiMock();
    const filesApiMock = getFilesApiMock();
    const projectsApiMock = getProjectsApiMock();
    const webhooksApiMock = getWebhooksApiMock();
    const workflowsApiMock = getWorkflowsApiMock();
    const jobBatchesApiMock = getJobBatchesApiMock();
    const jobsApiMock = getJobsApiMock();

    return {
        logger: getRemoteLoggerMock(),
        credentials: { userIdentifier: "test-uid", userSecret: "test-secret" },
        getFileTranslationsApi: () => fileTranslationsApiMock,
        getMTApi: () => mtApiMock,
        getFileTypeApi: () => fileTypeApiMock,
        getLocalesApi: () => localesApiMock,
        getLanguageDetectionApi: () => languageDetectionApiMock,
        getAccountsApi: () => accountsApiMock,
        getFilesApi: () => filesApiMock,
        getProjectsApi: () => projectsApiMock,
        getWebhooksApi: () => webhooksApiMock,
        getWorkflowsApi: () => workflowsApiMock,
        getJobBatchesApi: () => jobBatchesApiMock,
        getJobsApi: () => jobsApiMock,
        ...overrides
    } as unknown as Context;
};

export const createExecuteFunctionsMock = (): IExecuteFunctions => {
    return {
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-uid",
            userSecret: "test-secret"
        }),
        getNodeParameter: jest.fn(),
        getInputData: jest.fn().mockReturnValue([{ json: {} }]),
        getNode: jest.fn().mockReturnValue({ name: "Smartling", type: "smartling" }),
        helpers: {
            returnJsonArray: (items: any) => {
                if (Array.isArray(items)) {
                    return items.map((item) => ({ json: item }));
                }
                return [{ json: items }];
            },
            httpRequest: jest.fn(),
            getBinaryDataBuffer: jest.fn(),
            prepareBinaryData: jest.fn()
        },
        continueOnFail: jest.fn().mockReturnValue(false)
    } as unknown as IExecuteFunctions;
};

export const createHookFunctionsMock = (): IHookFunctions => {
    const staticData: Record<string, unknown> = {};

    return {
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-uid",
            userSecret: "test-secret"
        }),
        getNodeParameter: jest.fn(),
        getNodeWebhookUrl: jest.fn().mockReturnValue("https://n8n.test/webhook/test-id"),
        getWorkflowStaticData: jest.fn().mockReturnValue(staticData)
    } as unknown as IHookFunctions;
};

export const createWebhookFunctionsMock = (): IWebhookFunctions => {
    return {
        getBodyData: jest.fn(),
        getHeaderData: jest.fn(),
        getQueryData: jest.fn(),
        helpers: {
            returnJsonArray: (items: any) => {
                if (Array.isArray(items)) {
                    return items.map((item) => ({ json: item }));
                }
                return [{ json: items }];
            }
        }
    } as unknown as IWebhookFunctions;
};
