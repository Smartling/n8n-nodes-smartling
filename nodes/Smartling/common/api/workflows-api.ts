import { SmartlingBaseApi, BaseParameters, Logger, AccessTokenProvider } from "smartling-api-sdk-nodejs";

export class WorkflowSearchParameters extends BaseParameters {
    public setProjectId(projectId: string): WorkflowSearchParameters {
        this.set("projectId", projectId);
        return this;
    }

    public setKeyword(keyword: string): WorkflowSearchParameters {
        this.set("keyword", keyword);
        return this;
    }

    public setLocaleIds(localeIds: string[]): WorkflowSearchParameters {
        this.set("localeIds", localeIds);
        return this;
    }

    public setWorkflowUids(workflowUids: string[]): WorkflowSearchParameters {
        this.set("workflowUids", workflowUids);
        return this;
    }

    public setWorkflowStepUids(workflowStepUids: string[]): WorkflowSearchParameters {
        this.set("workflowStepUids", workflowStepUids);
        return this;
    }
}

export class SmartlingWorkflowsApi extends SmartlingBaseApi {
    constructor(smartlingApiBaseUrl: string, authApi: AccessTokenProvider, logger: Logger) {
        super(logger);
        this.authApi = authApi;
        this.entrypoint = `${smartlingApiBaseUrl}/workflows-api/v3/accounts`;
    }

    async searchWorkflows(accountUid: string, params: WorkflowSearchParameters): Promise<any> {
        return await this.makeRequest(
            "post",
            `${this.entrypoint}/${accountUid}/workflows`,
            JSON.stringify(params.export())
        );
    }
}
