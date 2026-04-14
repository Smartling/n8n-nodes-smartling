const mockSmartlingRequest = jest.fn();
const mockResolveAccountUid = jest.fn().mockResolvedValue("acc-456");
jest.mock("../common/smartling-api", () => ({
    smartlingRequest: (...args: any[]) => mockSmartlingRequest(...args),
    resolveAccountUid: (...args: any[]) => mockResolveAccountUid(...args),
}));

import { searchProjects } from "./list-search";

const bindThis = (fn: Function) =>
    fn.bind({
        getCurrentNodeParameter: jest.fn(),
        helpers: {
            httpRequestWithAuthentication: jest.fn(),
        },
    });

describe("searchProjects", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockResolveAccountUid.mockResolvedValue("acc-456");
    });

    it("should return projects list", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [
                { projectId: "p1", projectName: "Project One" },
                { projectId: "p2", projectName: "Project Two" },
            ],
        });

        const result = await bindThis(searchProjects)();

        expect(result).toEqual({
            results: [
                { name: "Project One", value: "p1" },
                { name: "Project Two", value: "p2" },
            ],
            paginationToken: undefined,
        });
        expect(mockResolveAccountUid).toHaveBeenCalled();
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                method: "GET",
                path: "/accounts-api/v2/accounts/acc-456/projects",
            })
        );
    });

    it("should pass filter to API via projectNameFilter query param", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [
                { projectId: "p1", projectName: "Filtered Project" },
            ],
        });

        const result = await bindThis(searchProjects)("Filtered");

        expect(result.results).toEqual([
            { name: "Filtered Project", value: "p1" },
        ]);
        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                qs: expect.objectContaining({ projectNameFilter: "Filtered" }),
            })
        );
    });

    it("should handle pagination", async () => {
        const items = Array.from({ length: 100 }, (_, i) => ({
            projectId: `p${i}`,
            projectName: `Project ${i}`,
        }));

        mockSmartlingRequest.mockResolvedValue({ items });

        const result = await bindThis(searchProjects)(undefined, "0");

        expect(result.results).toHaveLength(100);
        expect(result.paginationToken).toBe("100");
    });

    it("should return no pagination token when fewer results than page size", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [{ projectId: "p1", projectName: "Only One" }],
        });

        const result = await bindThis(searchProjects)();

        expect(result.paginationToken).toBeUndefined();
    });
});
