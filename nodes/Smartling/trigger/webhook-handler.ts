import type { IWebhookFunctions, IWebhookResponseData } from "n8n-workflow";

export async function handleWebhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    return {
        workflowData: [this.helpers.returnJsonArray(bodyData)],
    };
}
