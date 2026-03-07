import {
    SmartlingApiClientBuilder,
    SmartlingFileTranslationsApi,
    SmartlingMachineTranslationsApi,
    SmartlingLocalesApi,
    SmartlingFilesApi,
    SmartlingBaseApi,
    AccessTokenProvider,
    SmartlingProjectsApi,
    SmartlingWebhooksApi,
    SmartlingJobsApi,
    SmartlingJobBatchesApi
} from "smartling-api-sdk-nodejs";
import {
    SmartlingFileTypesApi,
    SmartlingLanguageDetectionApi,
    SmartlingAccountsApi,
    SmartlingWorkflowsApi,
    SmartlingLogApi,
    SearchAccountsParameters
} from "@smartling/api-sdk-nodejs-internal";
import { SmartlingCredentials, createApiBuilder } from "./api";
import { RemoteLogger } from "./logger";
import { REQUEST_ID_HEADER } from "./constants";

export class Context {
    readonly logger: RemoteLogger;

    readonly credentials: SmartlingCredentials;

    private readonly apiBuilder: SmartlingApiClientBuilder;

    private readonly apiMap = new Map<string, SmartlingBaseApi>();

    private accountUidPromise: Promise<string> | undefined;

    constructor(
        credentials: SmartlingCredentials,
        actionName: string,
        version: string,
        logContextOverrides?: Record<string, unknown>
    ) {
        this.credentials = credentials;
        this.apiBuilder = createApiBuilder(credentials, version);

        const logApi = this.apiBuilder.build(SmartlingLogApi) as SmartlingLogApi;
        this.logger = new RemoteLogger(logApi, actionName, logContextOverrides ?? {}, version);

        this.apiBuilder.setHttpClientConfiguration({
            headers: {
                [REQUEST_ID_HEADER]: this.logger.getRequestId()
            }
        });
    }

    public getFileTranslationsApi(): SmartlingFileTranslationsApi {
        return this.getApiInstance(SmartlingFileTranslationsApi);
    }

    public getMTApi(): SmartlingMachineTranslationsApi {
        return this.getApiInstance(SmartlingMachineTranslationsApi);
    }

    public getFileTypeApi(): SmartlingFileTypesApi {
        return this.getApiInstance(SmartlingFileTypesApi);
    }

    public getLocalesApi(): SmartlingLocalesApi {
        return this.getApiInstance(SmartlingLocalesApi);
    }

    public getLanguageDetectionApi(): SmartlingLanguageDetectionApi {
        return this.getApiInstance(SmartlingLanguageDetectionApi);
    }

    public getAccountsApi(): SmartlingAccountsApi {
        return this.getApiInstance(SmartlingAccountsApi);
    }

    public getFilesApi(): SmartlingFilesApi {
        return this.getApiInstance(SmartlingFilesApi);
    }

    public getProjectsApi(): SmartlingProjectsApi {
        return this.getApiInstance(SmartlingProjectsApi);
    }

    public getWebhooksApi(): SmartlingWebhooksApi {
        return this.getApiInstance(SmartlingWebhooksApi);
    }

    public getWorkflowsApi(): SmartlingWorkflowsApi {
        return this.getApiInstance(SmartlingWorkflowsApi);
    }

    public getJobsApi(): SmartlingJobsApi {
        return this.getApiInstance(SmartlingJobsApi);
    }

    public getJobBatchesApi(): SmartlingJobBatchesApi {
        return this.getApiInstance(SmartlingJobBatchesApi);
    }

    public async resolveAccountUid(): Promise<string> {
        if (!this.accountUidPromise) {
            this.accountUidPromise = (async () => {
                const accountsApi = this.getAccountsApi();
                const params = new SearchAccountsParameters().setLimit(1);
                const result = await accountsApi.searchAccounts(params);
                const accounts = (result as any).accounts;
                if (!accounts?.length) {
                    throw new Error("No Smartling account found for these credentials");
                }
                return accounts[0].accountUid as string;
            })();
        }
        return this.accountUidPromise;
    }

    private getApiInstance<T extends SmartlingBaseApi>(apiClass: new (baseUrl: string, authApi: AccessTokenProvider, logger: any) => T) {
        if (!this.apiMap.has(apiClass.name)) {
            this.apiMap.set(apiClass.name, this.apiBuilder.build(apiClass) as T);
        }
        return this.apiMap.get(apiClass.name) as T;
    }
}

export const createContext = (
    credentials: SmartlingCredentials,
    actionName: string,
    version: string,
    logContextOverrides?: Record<string, unknown>
) => new Context(credentials, actionName, version, logContextOverrides);
