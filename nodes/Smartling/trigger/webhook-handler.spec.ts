import { createWebhookFunctionsMock } from "../../../test/mocks";
import { handleWebhook } from "./webhook-handler";

describe("webhook-handler", () => {
    let webhookFunctions: ReturnType<typeof createWebhookFunctionsMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        webhookFunctions = createWebhookFunctionsMock();
    });

    it("should return body data as workflow data", async () => {
        const bodyData = {
            eventType: "file.published",
            account: { accountUid: "acc-123" },
            project: { projectUid: "proj-456" },
        };
        (webhookFunctions.getBodyData as jest.Mock).mockReturnValue(bodyData);

        const result = await handleWebhook.call(webhookFunctions);

        expect(result).toEqual({
            workflowData: [[{ json: bodyData }]],
        });
    });

    it("should handle empty body", async () => {
        (webhookFunctions.getBodyData as jest.Mock).mockReturnValue({});

        const result = await handleWebhook.call(webhookFunctions);

        expect(result).toEqual({
            workflowData: [[{ json: {} }]],
        });
    });
});
