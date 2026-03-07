import type {
    IHookFunctions,
    IWebhookFunctions,
    INodeType,
    INodeTypeDescription,
    IWebhookResponseData,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    INodeListSearchResult,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";
import { EventTypes } from "./common/webhooks/event-types";
import { webhookCheckExists, webhookCreate, webhookDelete } from "./trigger/webhook-lifecycle";
import { handleWebhook } from "./trigger/webhook-handler";
import { getProjectLocales } from "./methods/load-options";
import { searchProjects } from "./methods/list-search";

export class SmartlingTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Smartling Trigger",
        name: "smartlingTrigger",
        icon: "file:smartling.svg",
        group: ["trigger"],
        version: 1,
        subtitle: '={{$parameter["event"]}}',
        description: "Triggers workflow on Smartling events",
        defaults: { name: "Smartling Trigger" },
        inputs: [],
        outputs: [NodeConnectionTypes.Main],
        credentials: [{ name: "smartlingApi", required: true }],
        webhooks: [
            {
                name: "default",
                httpMethod: "POST",
                responseMode: "onReceived",
                path: "webhook",
            },
        ],
        properties: [
            {
                displayName: "Event",
                name: "event",
                type: "options",
                required: true,
                default: EventTypes.FILE_PUBLISHED,
                options: [
                    // File events
                    { name: "File Published", value: EventTypes.FILE_PUBLISHED, description: "Triggers when every eligible string in the file has reached the \"Published\" step." },
                    // Source Issue events
                    { name: "Source Issue Created", value: EventTypes.SOURCE_ISSUE_CREATED, description: "Triggers when a source issue is created." },
                    { name: "Source Issue Updated", value: EventTypes.SOURCE_ISSUE_UPDATED, description: "Triggers when a source issue is updated." },
                    { name: "Source Issue Deleted", value: EventTypes.SOURCE_ISSUE_DELETED, description: "Triggers when a source issue is deleted." },
                    { name: "Source Issue Comment Created", value: EventTypes.SOURCE_ISSUE_COMMENT_CREATED, description: "Triggers when a comment is created on a source issue." },
                    { name: "Source Issue Comment Updated", value: EventTypes.SOURCE_ISSUE_COMMENT_UPDATED, description: "Triggers when a comment is updated on a source issue." },
                    { name: "Source Issue Comment Deleted", value: EventTypes.SOURCE_ISSUE_COMMENT_DELETED, description: "Triggers when a comment is deleted on a source issue." },
                    // Translation Issue events
                    { name: "Translation Issue Created", value: EventTypes.TRANSLATION_ISSUE_CREATED, description: "Triggers when a translation issue is created." },
                    { name: "Translation Issue Updated", value: EventTypes.TRANSLATION_ISSUE_UPDATED, description: "Triggers when a translation issue is updated." },
                    { name: "Translation Issue Deleted", value: EventTypes.TRANSLATION_ISSUE_DELETED, description: "Triggers when a translation issue is deleted." },
                    { name: "Translation Issue Comment Created", value: EventTypes.TRANSLATION_ISSUE_COMMENT_CREATED, description: "Triggers when a comment is created on a translation issue." },
                    { name: "Translation Issue Comment Updated", value: EventTypes.TRANSLATION_ISSUE_COMMENT_UPDATED, description: "Triggers when a comment is updated on a translation issue." },
                    { name: "Translation Issue Comment Deleted", value: EventTypes.TRANSLATION_ISSUE_COMMENT_DELETED, description: "Triggers when a comment is deleted on a translation issue." },
                    // Translation Job events
                    { name: "Translation Job Created", value: EventTypes.TRANSLATION_JOB_CREATED, description: "Triggers when a translation job is created." },
                    { name: "Translation Job Updated", value: EventTypes.TRANSLATION_JOB_UPDATED, description: "Triggers when a translation job is updated." },
                    { name: "Translation Job Completed", value: EventTypes.TRANSLATION_JOB_COMPLETED, description: "Triggers when a translation job is completed." },
                    { name: "Translation Job Canceled", value: EventTypes.TRANSLATION_JOB_CANCELED, description: "Triggers when a translation job is canceled." },
                ],
            },
            {
                displayName: "Smartling Projects",
                name: "projectUids",
                type: "multiOptions",
                default: [],
                description: "Select the project(s) to listen to webhooks from.",
                typeOptions: {
                    loadOptionsMethod: "getProjectsForFilter",
                },
            },
        ],
    };

    methods = {
        loadOptions: {
            // For the projectUids filter, we need a method that returns projects as options
            async getProjectsForFilter(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                // Use searchProjects internally but return as simple options
                const result = await searchProjects.call(this);
                return result.results.map((r) => ({ name: r.name, value: r.value as string }));
            },
            getProjectLocales,
        },
        listSearch: {
            searchProjects,
        },
    };

    webhookMethods = {
        default: {
            async checkExists(this: IHookFunctions): Promise<boolean> {
                const event = this.getNodeParameter("event") as string;
                return webhookCheckExists.call(this, event);
            },
            async create(this: IHookFunctions): Promise<boolean> {
                const event = this.getNodeParameter("event") as string;
                const projectUids = this.getNodeParameter("projectUids", []) as string[];
                return webhookCreate.call(this, event, projectUids.length ? projectUids : undefined);
            },
            async delete(this: IHookFunctions): Promise<boolean> {
                return webhookDelete.call(this);
            },
        },
    };

    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        return handleWebhook.call(this);
    }
}
