import type { ILoadOptionsFunctions, INodeListSearchResult } from "n8n-workflow";
import { smartlingRequest, resolveAccountUid } from "../common/smartling-api";

const PAGE_SIZE = 100;

export async function searchProjects(
    this: ILoadOptionsFunctions,
    filter?: string,
    paginationToken?: string
): Promise<INodeListSearchResult> {
    const accountUid = await resolveAccountUid(this);
    const offset = paginationToken ? parseInt(paginationToken, 10) : 0;

    const qs: Record<string, string | number> = {
        offset,
        limit: PAGE_SIZE,
    };
    if (filter) {
        qs.projectNameFilter = filter;
    }

    const response = await smartlingRequest(this, {
        method: "GET",
        path: `/accounts-api/v2/accounts/${accountUid}/projects`,
        qs,
    });

    const items = (response.items ?? response).map((project: any) => ({
        name: project.projectName,
        value: project.projectId,
    }));

    const nextOffset = offset + PAGE_SIZE;
    const hasMore = items.length === PAGE_SIZE;

    return {
        results: items,
        paginationToken: hasMore ? String(nextOffset) : undefined,
    };
}
