import type { ILoadOptionsFunctions, INodePropertyOptions } from "n8n-workflow";
import { createContext } from "../common/context";
import type { SmartlingCredentials } from "../common/api";
import { ListProjectsParameters } from "smartling-api-sdk-nodejs";
import { WorkflowSearchParameters } from "@smartling/api-sdk-nodejs-internal";

const getCredentials = async (self: ILoadOptionsFunctions): Promise<SmartlingCredentials> => {
    const creds = await self.getCredentials("smartlingApi");
    return {
        userIdentifier: creds.userIdentifier as string,
        userSecret: creds.userSecret as string,
    };
};

const getVersion = (): string => "0.1.0";

export async function getMtLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const credentials = await getCredentials(this);
    const ctx = createContext(credentials, "getMtLocales", getVersion());
    try {
        const localesApi = ctx.getLocalesApi();
        const response = await localesApi.getLocales();
        const locales = response.items
            .filter((locale) => locale.mtSupported)
            .map((locale) => ({
                name: `${locale.language.description} (${locale.localeId})`,
                value: locale.localeId,
            }));
        return [{ name: "Auto-Detect", value: "" }, ...locales];
    } finally {
        await ctx.logger.flush();
    }
}

export async function getProjectLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const credentials = await getCredentials(this);
    const projectUid = this.getCurrentNodeParameter("projectUid") as string;
    if (!projectUid) return [];
    const ctx = createContext(credentials, "getProjectLocales", getVersion());
    try {
        const projectsApi = ctx.getProjectsApi();
        const project = await projectsApi.getProjectDetails(projectUid);
        return project.targetLocales
            .filter((locale) => locale.enabled)
            .map((locale) => ({
                name: `${locale.description} (${locale.localeId})`,
                value: locale.localeId,
            }));
    } finally {
        await ctx.logger.flush();
    }
}

export async function getProjectWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const credentials = await getCredentials(this);
    const projectUid = this.getCurrentNodeParameter("projectUid") as string;
    if (!projectUid) return [];
    const ctx = createContext(credentials, "getProjectWorkflows", getVersion());
    try {
        const accountUid = await ctx.resolveAccountUid();
        const workflowsApi = ctx.getWorkflowsApi();
        const params = new WorkflowSearchParameters().setProjectId(projectUid);
        const response = await workflowsApi.searchWorkflows(accountUid, params);
        return response.items.map((workflow) => ({
            name: workflow.workflowName,
            value: workflow.workflowUid,
        }));
    } finally {
        await ctx.logger.flush();
    }
}
