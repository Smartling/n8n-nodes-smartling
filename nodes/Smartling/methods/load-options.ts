import type { ILoadOptionsFunctions, INodePropertyOptions } from "n8n-workflow";
import { smartlingRequest, resolveAccountUid } from "../common/smartling-api";
import { extractResourceLocatorValue } from "../common/utils";

async function fetchMtLocales(self: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const response = await smartlingRequest(self, {
        method: "GET",
        path: "/locales-api/v2/dictionary/locales",
    });
    return (response.items ?? response)
        .filter((locale: any) => locale.mtSupported)
        .map((locale: any) => ({
            name: `${locale.language.description} (${locale.localeId})`,
            value: locale.localeId,
        }));
}

export async function getMtSourceLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const locales = await fetchMtLocales(this);
    return [{ name: "Auto-Detect", value: "" }, ...locales];
}

export async function getMtTargetLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    return fetchMtLocales(this);
}

export async function getProjectLocales(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const projectUid = extractResourceLocatorValue(this.getCurrentNodeParameter("projectUid"));
    if (!projectUid) return [];

    const project = await smartlingRequest(this, {
        method: "GET",
        path: `/projects-api/v2/projects/${projectUid}`,
    });

    return (project.targetLocales ?? [])
        .filter((locale: any) => locale.enabled)
        .map((locale: any) => ({
            name: `${locale.description} (${locale.localeId})`,
            value: locale.localeId,
        }));
}

export async function getProjectWorkflows(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const projectUid = extractResourceLocatorValue(this.getCurrentNodeParameter("projectUid"));
    if (!projectUid) return [];

    const accountUid = await resolveAccountUid(this);
    const response = await smartlingRequest(this, {
        method: "POST",
        path: `/workflows-api/v3/accounts/${accountUid}/workflows`,
        body: { projectId: projectUid },
    });

    return (response.items ?? []).map((workflow: any) => ({
        name: workflow.workflowName,
        value: workflow.workflowUid,
    }));
}
