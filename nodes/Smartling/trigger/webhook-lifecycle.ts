import type { IHookFunctions } from "n8n-workflow";
import { smartlingRequest, resolveAccountUid } from "../common/smartling-api";

export async function webhookCheckExists(
    this: IHookFunctions,
    event: string
): Promise<boolean> {
    const accountUid = await resolveAccountUid(this);
    const webhookUrl = this.getNodeWebhookUrl("default");

    const response = await smartlingRequest(this, {
        method: "GET",
        path: `/webhooks-api/v2/accounts/${accountUid}/subscriptions`,
    });

    const subscriptions = response.items ?? response;
    const existing = subscriptions.find((sub: any) =>
        sub.subscriptionUrl === webhookUrl &&
        sub.events?.some((e: any) => e.type === event)
    );

    if (existing) {
        const staticData = this.getWorkflowStaticData("node");
        staticData.webhookId = existing.subscriptionUid;
        return true;
    }

    return false;
}

export async function webhookCreate(
    this: IHookFunctions,
    event: string,
    projectUids?: string[]
): Promise<boolean> {
    const accountUid = await resolveAccountUid(this);
    const webhookUrl = this.getNodeWebhookUrl("default");

    const subscriptionName = `[Smartling n8n] - ${event}`;
    const body: Record<string, any> = {
        subscriptionName,
        subscriptionUrl: webhookUrl,
        events: [{ type: event, schemaVersion: "1.0" }],
    };
    if (projectUids?.length) {
        body.projectUids = projectUids;
    }

    const result = await smartlingRequest(this, {
        method: "POST",
        path: `/webhooks-api/v2/accounts/${accountUid}/subscriptions`,
        body,
    });

    const staticData = this.getWorkflowStaticData("node");
    staticData.webhookId = result.subscriptionUid;

    return true;
}

export async function webhookDelete(this: IHookFunctions): Promise<boolean> {
    const staticData = this.getWorkflowStaticData("node");
    const webhookId = staticData.webhookId as string | undefined;

    if (!webhookId) return true;

    try {
        const accountUid = await resolveAccountUid(this);
        await smartlingRequest(this, {
            method: "DELETE",
            path: `/webhooks-api/v2/accounts/${accountUid}/subscriptions/${webhookId}`,
        });
    } catch {
        // Ignore errors on delete — subscription may already be gone
    }

    delete staticData.webhookId;
    return true;
}
