import type { ILoadOptionsFunctions, INodeListSearchResult } from "n8n-workflow";
import { ListProjectsParameters } from "smartling-api-sdk-nodejs";
import { createContext } from "../common/context";
import type { SmartlingCredentials } from "../common/api";

const getCredentials = async (self: ILoadOptionsFunctions): Promise<SmartlingCredentials> => {
    const creds = await self.getCredentials("smartlingApi");
    return {
        userIdentifier: creds.userIdentifier as string,
        userSecret: creds.userSecret as string,
    };
};

const getVersion = (): string => "0.1.0";

const PAGE_SIZE = 100;

export async function searchProjects(
    this: ILoadOptionsFunctions,
    filter?: string,
    paginationToken?: string,
): Promise<INodeListSearchResult> {
    const credentials = await getCredentials(this);
    const ctx = createContext(credentials, "searchProjects", getVersion());
    try {
        const accountUid = await ctx.resolveAccountUid();
        const projectsApi = ctx.getProjectsApi();
        const offset = paginationToken ? parseInt(paginationToken, 10) : 0;
        const params = new ListProjectsParameters()
            .setOffset(offset)
            .setLimit(PAGE_SIZE);

        if (filter) {
            params.setProjectNameFilter(filter);
        }

        const response = await projectsApi.listProjects(accountUid, params);
        const results = response.items.map((project) => ({
            name: project.projectName,
            value: project.projectId,
        }));
        const hasMore = response.items.length >= PAGE_SIZE;
        return {
            results,
            paginationToken: hasMore ? String(offset + PAGE_SIZE) : undefined,
        };
    } finally {
        await ctx.logger.flush();
    }
}
