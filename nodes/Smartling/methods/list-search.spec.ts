jest.mock("../common/context");

import { searchProjects } from "./list-search";
import { createContext } from "../common/context";

const mockCreateContext = createContext as jest.MockedFunction<typeof createContext>;

const mockFlush = jest.fn().mockResolvedValue(undefined);

const createMockContext = (apiOverrides: Record<string, unknown> = {}) => ({
    logger: { flush: mockFlush },
    ...apiOverrides,
});

const bindThis = (fn: Function) =>
    fn.bind({
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-user",
            userSecret: "test-secret",
        }),
        getCurrentNodeParameter: jest.fn(),
    });

describe("searchProjects", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return projects list", async () => {
        const mockProjectsApi = {
            listProjects: jest.fn().mockResolvedValue({
                items: [
                    { projectId: "p1", projectName: "Project One" },
                    { projectId: "p2", projectName: "Project Two" },
                ],
            }),
        };

        mockCreateContext.mockReturnValue(
            createMockContext({
                getProjectsApi: () => mockProjectsApi,
                resolveAccountUid: jest.fn().mockResolvedValue("acc-456"),
            }) as any,
        );

        const result = await bindThis(searchProjects)();

        expect(result).toEqual({
            results: [
                { name: "Project One", value: "p1" },
                { name: "Project Two", value: "p2" },
            ],
            paginationToken: undefined,
        });
        expect(mockFlush).toHaveBeenCalledTimes(1);
    });

    it("should pass filter to API via setProjectNameFilter", async () => {
        const mockProjectsApi = {
            listProjects: jest.fn().mockResolvedValue({
                items: [
                    { projectId: "p1", projectName: "Filtered Project" },
                ],
            }),
        };

        mockCreateContext.mockReturnValue(
            createMockContext({
                getProjectsApi: () => mockProjectsApi,
                resolveAccountUid: jest.fn().mockResolvedValue("acc-456"),
            }) as any,
        );

        const result = await bindThis(searchProjects)("Filtered");

        expect(result.results).toEqual([
            { name: "Filtered Project", value: "p1" },
        ]);
        expect(mockProjectsApi.listProjects).toHaveBeenCalledWith(
            "acc-456",
            expect.anything(),
        );
    });

    it("should handle pagination", async () => {
        const items = Array.from({ length: 100 }, (_, i) => ({
            projectId: `p${i}`,
            projectName: `Project ${i}`,
        }));

        const mockProjectsApi = {
            listProjects: jest.fn().mockResolvedValue({ items }),
        };

        mockCreateContext.mockReturnValue(
            createMockContext({
                getProjectsApi: () => mockProjectsApi,
                resolveAccountUid: jest.fn().mockResolvedValue("acc-456"),
            }) as any,
        );

        const result = await bindThis(searchProjects)(undefined, "0");

        expect(result.results).toHaveLength(100);
        expect(result.paginationToken).toBe("100");
    });

    it("should return no pagination token when fewer results than page size", async () => {
        const mockProjectsApi = {
            listProjects: jest.fn().mockResolvedValue({
                items: [{ projectId: "p1", projectName: "Only One" }],
            }),
        };

        mockCreateContext.mockReturnValue(
            createMockContext({
                getProjectsApi: () => mockProjectsApi,
                resolveAccountUid: jest.fn().mockResolvedValue("acc-456"),
            }) as any,
        );

        const result = await bindThis(searchProjects)();

        expect(result.paginationToken).toBeUndefined();
    });

});
