import { SmartlingBaseApi, BaseParameters, SmartlingException, Logger, AccessTokenProvider } from "smartling-api-sdk-nodejs";

export class SearchAccountsParameters extends BaseParameters {
    setKeyword(keyword: string): SearchAccountsParameters {
        this.set("keyword", keyword);
        return this;
    }

    setLimit(limit: number): SearchAccountsParameters {
        if (limit <= 0) {
            throw new SmartlingException("Limit must be > 0");
        }
        this.set("limit", limit);
        return this;
    }
}

export class SmartlingAccountsApi extends SmartlingBaseApi {
    constructor(smartlingApiBaseUrl: string, authApi: AccessTokenProvider, logger: Logger) {
        super(logger);
        this.authApi = authApi;
        this.entrypoint = `${smartlingApiBaseUrl}/accounts-api/v2`;
    }

    public searchAccounts(query?: SearchAccountsParameters): Promise<any> {
        return this.makeRequest("get", `${this.entrypoint}/accounts`, query?.export());
    }
}
