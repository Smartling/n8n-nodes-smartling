const mockSmartlingRequest = jest.fn();
const mockResolveAccountUid = jest.fn().mockResolvedValue("test-account-uid");
jest.mock("../common/smartling-api", () => ({
    smartlingRequest: (...args: any[]) => mockSmartlingRequest(...args),
    resolveAccountUid: (...args: any[]) => mockResolveAccountUid(...args),
}));

import { getMtSourceLocales, getMtTargetLocales, getProjectLocales, getProjectWorkflows } from "./load-options";

const bindThis = (fn: Function, paramOverrides: Record<string, unknown> = {}) =>
    fn.bind({
        getCurrentNodeParameter: jest.fn().mockImplementation((name: string) => {
            const params: Record<string, unknown> = {
                projectUid: { __rl: true, value: "proj-123", mode: "list", cachedResultName: "Test Project" },
                accountUid: "acc-456",
                ...paramOverrides,
            };
            return params[name];
        }),
        helpers: {
            httpRequestWithAuthentication: jest.fn(),
        },
    });

const mockLocalesResponse = {
    items: [
        {
            localeId: "en-US",
            mtSupported: true,
            language: { description: "English (United States)" },
        },
        {
            localeId: "fr-FR",
            mtSupported: true,
            language: { description: "French (France)" },
        },
        {
            localeId: "xx-XX",
            mtSupported: false,
            language: { description: "Unsupported" },
        },
    ],
};

const expectedMtLocales = [
    { name: "English (United States) (en-US)", value: "en-US" },
    { name: "French (France) (fr-FR)", value: "fr-FR" },
];

describe("getMtSourceLocales", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return Auto-Detect followed by MT-supported locales", async () => {
        mockSmartlingRequest.mockResolvedValue(mockLocalesResponse);

        const result = await bindThis(getMtSourceLocales)();

        expect(result).toEqual([
            { name: "Auto-Detect", value: "" },
            ...expectedMtLocales,
        ]);
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            { method: "GET", path: "/locales-api/v2/dictionary/locales" }
        );
    });
});

describe("getMtTargetLocales", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return MT-supported locales without Auto-Detect", async () => {
        mockSmartlingRequest.mockResolvedValue(mockLocalesResponse);

        const result = await bindThis(getMtTargetLocales)();

        expect(result).toEqual(expectedMtLocales);
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            { method: "GET", path: "/locales-api/v2/dictionary/locales" }
        );
    });
});

describe("getProjectLocales", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return enabled project locales", async () => {
        mockSmartlingRequest.mockResolvedValue({
            targetLocales: [
                { localeId: "de-DE", description: "German (Germany)", enabled: true },
                { localeId: "ja-JP", description: "Japanese", enabled: true },
                { localeId: "ko-KR", description: "Korean", enabled: false },
            ],
        });

        const result = await bindThis(getProjectLocales)();

        expect(result).toEqual([
            { name: "German (Germany) (de-DE)", value: "de-DE" },
            { name: "Japanese (ja-JP)", value: "ja-JP" },
        ]);
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            { method: "GET", path: "/projects-api/v2/projects/proj-123" }
        );
    });

    it("should return empty array when no projectUid", async () => {
        const result = await bindThis(getProjectLocales, { projectUid: "" })();

        expect(result).toEqual([]);
        expect(mockSmartlingRequest).not.toHaveBeenCalled();
    });
});

describe("getProjectWorkflows", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return workflows for the project", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [
                { workflowUid: "wf-1", workflowName: "Translation" },
                { workflowUid: "wf-2", workflowName: "Review" },
            ],
        });

        const result = await bindThis(getProjectWorkflows)();

        expect(result).toEqual([
            { name: "Translation", value: "wf-1" },
            { name: "Review", value: "wf-2" },
        ]);
        expect(mockResolveAccountUid).toHaveBeenCalled();
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            {
                method: "POST",
                path: "/workflows-api/v3/accounts/test-account-uid/workflows",
                body: { projectId: "proj-123" },
            }
        );
    });

    it("should return empty array when no projectUid", async () => {
        const result = await bindThis(getProjectWorkflows, { projectUid: "" })();

        expect(result).toEqual([]);
        expect(mockSmartlingRequest).not.toHaveBeenCalled();
        expect(mockResolveAccountUid).not.toHaveBeenCalled();
    });
});
