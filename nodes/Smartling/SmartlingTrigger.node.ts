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
                    { name: "File Published", value: EventTypes.FILE_PUBLISHED, description: "Triggers when a file reaches Published step for all strings" },
                    // Source Issue events
                    { name: "Source Issue Created", value: EventTypes.SOURCE_ISSUE_CREATED },
                    { name: "Source Issue Updated", value: EventTypes.SOURCE_ISSUE_UPDATED },
                    { name: "Source Issue Deleted", value: EventTypes.SOURCE_ISSUE_DELETED },
                    { name: "Source Issue Comment Created", value: EventTypes.SOURCE_ISSUE_COMMENT_CREATED },
                    { name: "Source Issue Comment Updated", value: EventTypes.SOURCE_ISSUE_COMMENT_UPDATED },
                    { name: "Source Issue Comment Deleted", value: EventTypes.SOURCE_ISSUE_COMMENT_DELETED },
                    // Translation Issue events
                    { name: "Translation Issue Created", value: EventTypes.TRANSLATION_ISSUE_CREATED },
                    { name: "Translation Issue Updated", value: EventTypes.TRANSLATION_ISSUE_UPDATED },
                    { name: "Translation Issue Deleted", value: EventTypes.TRANSLATION_ISSUE_DELETED },
                    { name: "Translation Issue Comment Created", value: EventTypes.TRANSLATION_ISSUE_COMMENT_CREATED },
                    { name: "Translation Issue Comment Updated", value: EventTypes.TRANSLATION_ISSUE_COMMENT_UPDATED },
                    { name: "Translation Issue Comment Deleted", value: EventTypes.TRANSLATION_ISSUE_COMMENT_DELETED },
                    // Translation Job events
                    { name: "Translation Job Created", value: EventTypes.TRANSLATION_JOB_CREATED },
                    { name: "Translation Job Updated", value: EventTypes.TRANSLATION_JOB_UPDATED },
                    { name: "Translation Job Completed", value: EventTypes.TRANSLATION_JOB_COMPLETED },
                    { name: "Translation Job Canceled", value: EventTypes.TRANSLATION_JOB_CANCELED },
                ],
            },
            {
                displayName: "Filter by Projects",
                name: "projectUids",
                type: "multiOptions",
                default: [],
                description: "Optionally filter events to specific projects. Leave empty for all projects.",
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
