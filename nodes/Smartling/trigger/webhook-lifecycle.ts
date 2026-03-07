import type { IHookFunctions } from "n8n-workflow";
import { CreateSubscriptionParameters } from "smartling-api-sdk-nodejs";
import { createContext } from "../common/context";
import type { SmartlingCredentials } from "../common/api";

const getCredentials = async (self: IHookFunctions): Promise<SmartlingCredentials> => {
    const creds = await self.getCredentials("smartlingApi");
    return {
        userIdentifier: creds.userIdentifier as string,
        userSecret: creds.userSecret as string,
    };
};

export async function webhookCheckExists(
    this: IHookFunctions,
    eventType: string,
): Promise<boolean> {
    const credentials = await getCredentials(this);
    const ctx = createContext(credentials, "webhook.checkExists", "0.1.0");
    try {
        const webhookUrl = this.getNodeWebhookUrl("default");
        const accountUid = await ctx.resolveAccountUid();
        const webhooksApi = ctx.getWebhooksApi();

        const response = await webhooksApi.getSubscriptions(accountUid);
        const existing = response.items.find(
            (sub) =>
                sub.subscriptionUrl === webhookUrl &&
                sub.events.some((e) => e.type === eventType),
        );

        if (existing) {
            const staticData = this.getWorkflowStaticData("node");
            staticData.webhookId = existing.subscriptionUid;
            return true;
        }

        return false;
    } finally {
        await ctx.logger.flush();
    }
}

export async function webhookCreate(
    this: IHookFunctions,
    eventType: string,
    projectUids?: string[],
): Promise<boolean> {
    const credentials = await getCredentials(this);
    const ctx = createContext(credentials, "webhook.create", "0.1.0");
    try {
        const webhookUrl = this.getNodeWebhookUrl("default") as string;
        const accountUid = await ctx.resolveAccountUid();
        const webhooksApi = ctx.getWebhooksApi();

        const params = new CreateSubscriptionParameters(
            `[Smartling n8n] - ${eventType}`,
            webhookUrl,
            [{ type: eventType, schemaVersion: "1.0" }],
        );

        params.setDescription("This subscription is created and managed by Smartling n8n community node.");

        if (projectUids && projectUids.length > 0) {
            params.setProjectUids(projectUids);
        }

        const subscription = await webhooksApi.createSubscription(accountUid, params);

        ctx.logger.info("Successfully created webhook subscription", {
            subscriptionUid: subscription.subscriptionUid,
            eventType,
        });

        const staticData = this.getWorkflowStaticData("node");
        staticData.webhookId = subscription.subscriptionUid;

        return true;
    } finally {
        await ctx.logger.flush();
    }
}

export async function webhookDelete(this: IHookFunctions): Promise<boolean> {
    const credentials = await getCredentials(this);
    const ctx = createContext(credentials, "webhook.delete", "0.1.0");
    try {
        const staticData = this.getWorkflowStaticData("node");
        const webhookId = staticData.webhookId as string;

        if (!webhookId) {
            return false;
        }

        const accountUid = await ctx.resolveAccountUid();
        const webhooksApi = ctx.getWebhooksApi();

        try {
            await webhooksApi.deleteSubscription(accountUid, webhookId);

            ctx.logger.info("Successfully deleted webhook subscription", {
                subscriptionUid: webhookId,
            });
        } catch (error) {
            ctx.logger.warn("Failed to delete webhook subscription", {
                subscriptionUid: webhookId,
                error: String(error),
            });
            return false;
        }

        delete staticData.webhookId;
        return true;
    } finally {
        await ctx.logger.flush();
    }
}
