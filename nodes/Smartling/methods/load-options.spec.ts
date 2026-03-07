jest.mock("../common/context");

import { getMtSourceLocales, getMtTargetLocales, getProjectLocales, getProjectWorkflows } from "./load-options";
import { createContext } from "../common/context";

const mockCreateContext = createContext as jest.MockedFunction<typeof createContext>;

const mockFlush = jest.fn().mockResolvedValue(undefined);

const createMockContext = (apiOverrides: Record<string, unknown> = {}) => ({
    logger: { flush: mockFlush },
    ...apiOverrides,
});

const bindThis = (fn: Function, overrides: Record<string, unknown> = {}) =>
    fn.bind({
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-user",
            userSecret: "test-secret",
        }),
        getCurrentNodeParameter: jest.fn().mockImplementation((name: string) => {
            const params: Record<string, unknown> = {
                projectUid: { __rl: true, value: "proj-123", mode: "list", cachedResultName: "Test Project" },
                accountUid: "acc-456",
                ...overrides,
            };
            return params[name];
        }),
    });

const mockLocalesApi = {
    getLocales: jest.fn().mockResolvedValue({
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
    }),
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
        mockCreateContext.mockReturnValue(
            createMockContext({ getLocalesApi: () => mockLocalesApi }) as any,
        );

        const result = await bindThis(getMtSourceLocales)();

        expect(result).toEqual([
            { name: "Auto-Detect", value: "" },
            ...expectedMtLocales,
        ]);
        expect(mockFlush).toHaveBeenCalledTimes(1);
    });
});

describe("getMtTargetLocales", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return MT-supported locales without Auto-Detect", async () => {
        mockCreateContext.mockReturnValue(
            createMockContext({ getLocalesApi: () => mockLocalesApi }) as any,
        );

        const result = await bindThis(getMtTargetLocales)();

        expect(result).toEqual(expectedMtLocales);
        expect(mockFlush).toHaveBeenCalledTimes(1);
    });
});

describe("getProjectLocales", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return enabled project locales", async () => {
        const mockProjectsApi = {
            getProjectDetails: jest.fn().mockResolvedValue({
                targetLocales: [
                    { localeId: "de-DE", description: "German (Germany)", enabled: true },
                    { localeId: "ja-JP", description: "Japanese", enabled: true },
                    { localeId: "ko-KR", description: "Korean", enabled: false },
                ],
            }),
        };

        mockCreateContext.mockReturnValue(
            createMockContext({ getProjectsApi: () => mockProjectsApi }) as any,
        );

        const result = await bindThis(getProjectLocales)();

        expect(result).toEqual([
            { name: "German (Germany) (de-DE)", value: "de-DE" },
            { name: "Japanese (ja-JP)", value: "ja-JP" },
        ]);
        expect(mockProjectsApi.getProjectDetails).toHaveBeenCalledWith("proj-123");
        expect(mockFlush).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no projectUid", async () => {
        const result = await bindThis(getProjectLocales, { projectUid: "" })();

        expect(result).toEqual([]);
        expect(mockCreateContext).not.toHaveBeenCalled();
    });
});

describe("getProjectWorkflows", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return workflows for the project", async () => {
        const mockWorkflowsApi = {
            searchWorkflows: jest.fn().mockResolvedValue({
                items: [
                    { workflowUid: "wf-1", workflowName: "Translation" },
                    { workflowUid: "wf-2", workflowName: "Review" },
                ],
            }),
        };

        const mockResolveAccountUid = jest.fn().mockResolvedValue("acc-456");

        mockCreateContext.mockReturnValue(
            createMockContext({
                getWorkflowsApi: () => mockWorkflowsApi,
                resolveAccountUid: mockResolveAccountUid,
            }) as any,
        );

        const result = await bindThis(getProjectWorkflows)();

        expect(result).toEqual([
            { name: "Translation", value: "wf-1" },
            { name: "Review", value: "wf-2" },
        ]);
        expect(mockResolveAccountUid).toHaveBeenCalled();
        expect(mockWorkflowsApi.searchWorkflows).toHaveBeenCalledWith(
            "acc-456",
            expect.anything(),
        );
        expect(mockFlush).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no projectUid", async () => {
        const result = await bindThis(getProjectWorkflows, { projectUid: "" })();

        expect(result).toEqual([]);
        expect(mockCreateContext).not.toHaveBeenCalled();
    });
});
