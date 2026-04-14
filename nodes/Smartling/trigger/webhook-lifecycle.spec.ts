import { createHookFunctionsMock } from "../../../test/mocks";
import { webhookCheckExists, webhookCreate, webhookDelete } from "./webhook-lifecycle";

const mockSmartlingRequest = jest.fn();
const mockResolveAccountUid = jest.fn().mockResolvedValue("test-account-uid");
jest.mock("../common/smartling-api", () => ({
    smartlingRequest: (...args: any[]) => mockSmartlingRequest(...args),
    resolveAccountUid: (...args: any[]) => mockResolveAccountUid(...args),
}));

describe("webhook-lifecycle", () => {
    let hookFunctions: ReturnType<typeof createHookFunctionsMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        hookFunctions = createHookFunctionsMock();
    });

    describe("webhookCheckExists", () => {
        it("should return true when matching webhook found", async () => {
            mockSmartlingRequest.mockResolvedValue({
                totalCount: 1,
                items: [
                    {
                        subscriptionUid: "sub-123",
                        subscriptionUrl: "https://n8n.test/webhook/test-id",
                        events: [{ type: "file.published", schemaVersion: "1.0" }],
                    },
                ],
            });

            const result = await webhookCheckExists.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(true);
            const staticData = hookFunctions.getWorkflowStaticData("node");
            expect(staticData.webhookId).toBe("sub-123");
        });

        it("should return false when no matching webhook found", async () => {
            mockSmartlingRequest.mockResolvedValue({
                totalCount: 1,
                items: [
                    {
                        subscriptionUid: "sub-456",
                        subscriptionUrl: "https://other.test/webhook/other-id",
                        events: [{ type: "file.published", schemaVersion: "1.0" }],
                    },
                ],
            });

            const result = await webhookCheckExists.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(false);
        });

        it("should return false when no subscriptions exist", async () => {
            mockSmartlingRequest.mockResolvedValue({
                totalCount: 0,
                items: [],
            });

            const result = await webhookCheckExists.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(false);
        });

        it("should return false when URL matches but event type differs", async () => {
            mockSmartlingRequest.mockResolvedValue({
                totalCount: 1,
                items: [
                    {
                        subscriptionUid: "sub-789",
                        subscriptionUrl: "https://n8n.test/webhook/test-id",
                        events: [{ type: "translationJob.created", schemaVersion: "1.0" }],
                    },
                ],
            });

            const result = await webhookCheckExists.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(false);
        });
    });

    describe("webhookCreate", () => {
        it("should call smartlingRequest POST and store webhookId", async () => {
            mockSmartlingRequest.mockResolvedValue({
                subscriptionUid: "new-sub-123",
                subscriptionUrl: "https://n8n.test/webhook/test-id",
                events: [{ type: "file.published", schemaVersion: "1.0" }],
            });

            const result = await webhookCreate.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(true);
            expect(mockSmartlingRequest).toHaveBeenCalledWith(
                hookFunctions,
                expect.objectContaining({
                    method: "POST",
                    path: "/webhooks-api/v2/accounts/test-account-uid/subscriptions",
                    body: expect.objectContaining({
                        subscriptionName: "[Smartling n8n] - file.published",
                        subscriptionUrl: "https://n8n.test/webhook/test-id",
                        events: [{ type: "file.published", schemaVersion: "1.0" }],
                    }),
                }),
            );
            const staticData = hookFunctions.getWorkflowStaticData("node");
            expect(staticData.webhookId).toBe("new-sub-123");
        });

        it("should pass projectUids in body when provided", async () => {
            mockSmartlingRequest.mockResolvedValue({
                subscriptionUid: "new-sub-456",
            });

            const result = await webhookCreate.call(
                hookFunctions,
                "file.published",
                ["project-1", "project-2"],
            );

            expect(result).toBe(true);
            expect(mockSmartlingRequest).toHaveBeenCalledWith(
                hookFunctions,
                expect.objectContaining({
                    body: expect.objectContaining({
                        projectUids: ["project-1", "project-2"],
                    }),
                }),
            );
        });

        it("should not include projectUids in body when empty array provided", async () => {
            mockSmartlingRequest.mockResolvedValue({
                subscriptionUid: "new-sub-789",
            });

            await webhookCreate.call(hookFunctions, "file.published", []);

            expect(mockSmartlingRequest).toHaveBeenCalledWith(
                hookFunctions,
                expect.objectContaining({
                    body: expect.not.objectContaining({
                        projectUids: expect.anything(),
                    }),
                }),
            );
        });
    });

    describe("webhookDelete", () => {
        it("should call smartlingRequest DELETE and clean static data", async () => {
            const staticData = hookFunctions.getWorkflowStaticData("node");
            staticData.webhookId = "sub-to-delete";

            mockSmartlingRequest.mockResolvedValue(undefined);

            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(true);
            expect(mockSmartlingRequest).toHaveBeenCalledWith(
                hookFunctions,
                expect.objectContaining({
                    method: "DELETE",
                    path: "/webhooks-api/v2/accounts/test-account-uid/subscriptions/sub-to-delete",
                }),
            );
            expect(staticData.webhookId).toBeUndefined();
        });

        it("should return true when no webhookId stored", async () => {
            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(true);
            expect(mockSmartlingRequest).not.toHaveBeenCalled();
        });

        it("should return true on API error without throwing and clean static data", async () => {
            const staticData = hookFunctions.getWorkflowStaticData("node");
            staticData.webhookId = "sub-to-delete";

            mockSmartlingRequest.mockRejectedValue(
                new Error("API Error: Not Found"),
            );

            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(true);
            expect(staticData.webhookId).toBeUndefined();
        });
    });
});
