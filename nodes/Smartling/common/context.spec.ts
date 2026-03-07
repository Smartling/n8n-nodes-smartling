import { Context, createContext } from "./context";
import { SmartlingCredentials } from "./api";

const mockBuild = jest.fn().mockReturnValue({});
const mockSetBaseSmartlingApiUrl = jest.fn().mockReturnThis();
const mockAuthWithUserIdAndUserSecret = jest.fn().mockReturnThis();
const mockSetClientLibMetadata = jest.fn().mockReturnThis();
const mockSetHttpClientConfiguration = jest.fn().mockReturnThis();

jest.mock("smartling-api-sdk-nodejs", () => ({
    SmartlingApiClientBuilder: jest.fn().mockImplementation(() => ({
        setBaseSmartlingApiUrl: mockSetBaseSmartlingApiUrl,
        authWithUserIdAndUserSecret: mockAuthWithUserIdAndUserSecret,
        setClientLibMetadata: mockSetClientLibMetadata,
        setHttpClientConfiguration: mockSetHttpClientConfiguration,
        build: mockBuild
    })),
    SmartlingFileTranslationsApi: class SmartlingFileTranslationsApi {},
    SmartlingMachineTranslationsApi: class SmartlingMachineTranslationsApi {},
    SmartlingLocalesApi: class SmartlingLocalesApi {},
    SmartlingFilesApi: class SmartlingFilesApi {},
    SmartlingBaseApi: class SmartlingBaseApi {},
    SmartlingProjectsApi: class SmartlingProjectsApi {},
    SmartlingWebhooksApi: class SmartlingWebhooksApi {},
    SmartlingJobsApi: class SmartlingJobsApi {},
    SmartlingJobBatchesApi: class SmartlingJobBatchesApi {},
    AccessTokenProvider: class AccessTokenProvider {}
}));

jest.mock("@smartling/api-sdk-nodejs-internal", () => ({
    SmartlingFileTypesApi: class SmartlingFileTypesApi {},
    SmartlingLanguageDetectionApi: class SmartlingLanguageDetectionApi {},
    SmartlingAccountsApi: class SmartlingAccountsApi {},
    SmartlingWorkflowsApi: class SmartlingWorkflowsApi {},
    SmartlingLogApi: class SmartlingLogApi {},
    SearchAccountsParameters: jest.fn().mockImplementation(() => ({
        setLimit: jest.fn().mockReturnThis()
    })),
    CreateLogParameters: jest.fn().mockImplementation(() => ({
        export: jest.fn().mockReturnValue({}),
        addLogRecord: jest.fn()
    })),
    LogLevel: {
        DEBUG: "DEBUG",
        INFO: "INFO",
        WARNING: "WARNING",
        ERROR: "ERROR"
    }
}));

describe("Context", () => {
    const credentials: SmartlingCredentials = {
        userIdentifier: "test-user",
        userSecret: "test-secret"
    };

    let ctx: Context;

    beforeEach(() => {
        jest.clearAllMocks();
        // Each build() call returns a new unique object so we can track lazy instantiation
        let callCount = 0;
        mockBuild.mockImplementation(() => ({ id: ++callCount }));
        ctx = createContext(credentials, "testAction", "1.0.0");
    });

    it("should create API instances lazily (same instance returned on multiple calls)", () => {
        const firstCall = ctx.getFileTranslationsApi();
        const secondCall = ctx.getFileTranslationsApi();

        expect(firstCall).toBe(secondCall);
        // build is called once for LogApi in constructor + once for FileTranslationsApi
        // The second getFileTranslationsApi call should NOT trigger another build
        const buildCallsForFileTranslations = mockBuild.mock.calls.length;
        ctx.getFileTranslationsApi();
        expect(mockBuild.mock.calls.length).toBe(buildCallsForFileTranslations);
    });

    it("should provide all API accessors", () => {
        const apiMethods = [
            "getFileTranslationsApi",
            "getMTApi",
            "getLocalesApi",
            "getFilesApi",
            "getWebhooksApi",
            "getAccountsApi",
            "getProjectsApi",
            "getWorkflowsApi",
            "getJobsApi",
            "getJobBatchesApi",
            "getFileTypeApi",
            "getLanguageDetectionApi"
        ] as const;

        for (const method of apiMethods) {
            expect(typeof ctx[method]).toBe("function");
            const result = ctx[method]();
            expect(result).toBeDefined();
        }
    });

    it("should return different instances for different API types", () => {
        const fileTranslationsApi = ctx.getFileTranslationsApi();
        const mtApi = ctx.getMTApi();

        expect(fileTranslationsApi).not.toBe(mtApi);
    });

    it("should store credentials", () => {
        expect(ctx.credentials).toBe(credentials);
    });

    it("should create context via factory function", () => {
        const factoryCtx = createContext(credentials, "testAction", "1.0.0", { extra: "data" });
        expect(factoryCtx).toBeInstanceOf(Context);
    });

    it("should resolve account UID and cache the result", async () => {
        const mockSearchAccounts = jest.fn().mockResolvedValue({
            accounts: [{ accountUid: "acc-123", accountName: "Test Account" }]
        });
        mockBuild.mockImplementation((apiClass: any) => {
            if (apiClass.name === "SmartlingAccountsApi") {
                return { searchAccounts: mockSearchAccounts };
            }
            return { id: "other" };
        });

        const freshCtx = createContext(credentials, "testAction", "1.0.0");
        const uid1 = await freshCtx.resolveAccountUid();
        const uid2 = await freshCtx.resolveAccountUid();

        expect(uid1).toBe("acc-123");
        expect(uid2).toBe("acc-123");
        expect(mockSearchAccounts).toHaveBeenCalledTimes(1);
        expect(freshCtx.logger.getContextValue("accountUid")).toBe("acc-123");
    });

    it("should throw when no accounts found", async () => {
        const mockSearchAccounts = jest.fn().mockResolvedValue({
            accounts: []
        });
        mockBuild.mockImplementation((apiClass: any) => {
            if (apiClass.name === "SmartlingAccountsApi") {
                return { searchAccounts: mockSearchAccounts };
            }
            return { id: "other" };
        });

        const freshCtx = createContext(credentials, "testAction", "1.0.0");
        await expect(freshCtx.resolveAccountUid()).rejects.toThrow(
            "No Smartling account found for these credentials"
        );
    });
});
