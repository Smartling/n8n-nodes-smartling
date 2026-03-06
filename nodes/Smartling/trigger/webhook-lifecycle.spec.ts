import { createHookFunctionsMock, createContextMock } from "../../../test/mocks";
import { webhookCheckExists, webhookCreate, webhookDelete } from "./webhook-lifecycle";
import { createContext } from "../common/context";

jest.mock("../common/context");
jest.mock("smartling-api-sdk-nodejs", () => ({
    ...jest.requireActual("smartling-api-sdk-nodejs"),
    CreateSubscriptionParameters: jest.fn().mockImplementation(
        (name: string, url: string, events: unknown[]) => ({
            subscriptionName: name,
            subscriptionUrl: url,
            events,
            setDescription: jest.fn().mockReturnThis(),
            setProjectUids: jest.fn().mockReturnThis(),
            export: jest.fn().mockReturnValue({
                subscriptionName: name,
                subscriptionUrl: url,
                events,
            }),
        }),
    ),
}));

const mockedCreateContext = createContext as jest.MockedFunction<typeof createContext>;

describe("webhook-lifecycle", () => {
    let hookFunctions: ReturnType<typeof createHookFunctionsMock>;
    let ctxMock: ReturnType<typeof createContextMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        hookFunctions = createHookFunctionsMock();
        ctxMock = createContextMock();
        mockedCreateContext.mockReturnValue(ctxMock);
        (hookFunctions.getNodeParameter as jest.Mock).mockReturnValue("test-account-uid");
    });

    describe("webhookCheckExists", () => {
        it("should return true when matching webhook found", async () => {
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.getSubscriptions as jest.Mock).mockResolvedValue({
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
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.getSubscriptions as jest.Mock).mockResolvedValue({
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
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.getSubscriptions as jest.Mock).mockResolvedValue({
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
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.getSubscriptions as jest.Mock).mockResolvedValue({
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
        it("should call createSubscription and store webhookId", async () => {
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.createSubscription as jest.Mock).mockResolvedValue({
                subscriptionUid: "new-sub-123",
                subscriptionUrl: "https://n8n.test/webhook/test-id",
                events: [{ type: "file.published", schemaVersion: "1.0" }],
            });

            const result = await webhookCreate.call(
                hookFunctions,
                "file.published",
            );

            expect(result).toBe(true);
            expect(webhooksApi.createSubscription).toHaveBeenCalledWith(
                "test-account-uid",
                expect.objectContaining({
                    subscriptionName: "[Smartling n8n] - file.published",
                    subscriptionUrl: "https://n8n.test/webhook/test-id",
                    events: [{ type: "file.published", schemaVersion: "1.0" }],
                }),
            );
            const staticData = hookFunctions.getWorkflowStaticData("node");
            expect(staticData.webhookId).toBe("new-sub-123");
        });

        it("should pass projectUids filter when provided", async () => {
            const webhooksApi = ctxMock.getWebhooksApi();
            const mockSubscription = {
                subscriptionUid: "new-sub-456",
                subscriptionUrl: "https://n8n.test/webhook/test-id",
                events: [{ type: "file.published", schemaVersion: "1.0" }],
            };
            (webhooksApi.createSubscription as jest.Mock).mockResolvedValue(mockSubscription);

            const result = await webhookCreate.call(
                hookFunctions,
                "file.published",
                ["project-1", "project-2"],
            );

            expect(result).toBe(true);
            const createCall = (webhooksApi.createSubscription as jest.Mock).mock.calls[0];
            expect(createCall[1].setProjectUids).toHaveBeenCalledWith(["project-1", "project-2"]);
        });

        it("should not call setProjectUids when projectUids is empty", async () => {
            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.createSubscription as jest.Mock).mockResolvedValue({
                subscriptionUid: "new-sub-789",
            });

            await webhookCreate.call(hookFunctions, "file.published", []);

            const createCall = (webhooksApi.createSubscription as jest.Mock).mock.calls[0];
            expect(createCall[1].setProjectUids).not.toHaveBeenCalled();
        });
    });

    describe("webhookDelete", () => {
        it("should call deleteSubscription and clean static data", async () => {
            const staticData = hookFunctions.getWorkflowStaticData("node");
            staticData.webhookId = "sub-to-delete";

            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.deleteSubscription as jest.Mock).mockResolvedValue(undefined);

            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(true);
            expect(webhooksApi.deleteSubscription).toHaveBeenCalledWith(
                "test-account-uid",
                "sub-to-delete",
            );
            expect(staticData.webhookId).toBeUndefined();
        });

        it("should return false when no webhookId stored", async () => {
            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(false);
            const webhooksApi = ctxMock.getWebhooksApi();
            expect(webhooksApi.deleteSubscription).not.toHaveBeenCalled();
        });

        it("should return false on API error without throwing", async () => {
            const staticData = hookFunctions.getWorkflowStaticData("node");
            staticData.webhookId = "sub-to-delete";

            const webhooksApi = ctxMock.getWebhooksApi();
            (webhooksApi.deleteSubscription as jest.Mock).mockRejectedValue(
                new Error("API Error: Not Found"),
            );

            const result = await webhookDelete.call(hookFunctions);

            expect(result).toBe(false);
            expect(staticData.webhookId).toBe("sub-to-delete");
        });
    });
});
