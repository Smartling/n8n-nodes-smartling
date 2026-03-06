import { WorkflowSearchParameters } from "@smartling/api-sdk-nodejs-internal";
import { Context } from "../../common/context";

const getWorkflowLink = (projectUid: string, workflowUid: string) =>
    `https://dashboard.smartling.com/app/projects/${projectUid}/dynamic-workflows/index.html?workflowUidSearch=${workflowUid}`;

export const validateWorkflow = async (
    ctx: Context,
    projectUid: string,
    accountUid: string,
    authorize: boolean,
    workflowUid: string | undefined,
    targetLocalesIds: string[]
) => {
    if (!authorize || !workflowUid) return;

    const params = new WorkflowSearchParameters().setProjectId(projectUid);
    const [workflowsResponse, projectsResponse] = await Promise.all([
        ctx.getWorkflowsApi().searchWorkflows(accountUid, params),
        ctx.getProjectsApi().getProjectDetails(projectUid)
    ]);

    const workflow = workflowsResponse.items.find((w: any) => w.workflowUid === workflowUid);

    if (!workflow) {
        throw new Error(
            `Can not retrieve information for provided workflow ${workflowUid}`
        );
    }

    const link = getWorkflowLink(projectUid, workflowUid);
    const projectSourceLocaleId = projectsResponse.sourceLocaleId;
    const workflowLocalePairs = workflow.localePairs?.find((p: any) => p.sourceLocaleId === projectSourceLocaleId);

    if (!workflowLocalePairs || !Array.isArray(workflowLocalePairs.targetLocaleIds)) {
        throw new Error(
            `Target Language Workflow\nWorkflow "${workflow.workflowName}" does not support the project's source language: ${projectsResponse.sourceLocaleId}.\nTo resolve this: \n- Select a different workflow, or \n- Add languages to "${workflow.workflowName}": ${link}`
        );
    }

    const missingLocaleIds = targetLocalesIds.filter((id: string) => !workflowLocalePairs.targetLocaleIds.includes(id));

    if (missingLocaleIds.length > 0) {
        const missingLocaleDescriptions = missingLocaleIds
            .map((id: string) => projectsResponse.targetLocales.find((l: any) => l.localeId === id)?.description)
            .filter(Boolean)
            .join(", ");

        throw new Error(
            `Target Language Workflow\nWorkflow "${workflow.workflowName}" does not support the selected language(s): ${missingLocaleDescriptions}.\nTo resolve this:\n- Select a different workflow, or\n- Add languages to "${workflow.workflowName}": ${link}`
        );
    }
};
