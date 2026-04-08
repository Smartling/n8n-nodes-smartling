import { SmartlingBaseApi, Logger, AccessTokenProvider } from "smartling-api-sdk-nodejs";

export class SmartlingLanguageDetectionApi extends SmartlingBaseApi {
    constructor(smartlingApiBaseUrl: string, authApi: AccessTokenProvider, logger: Logger) {
        super(logger);
        this.authApi = authApi;
        this.entrypoint = `${smartlingApiBaseUrl}/language-detection-api/v1`;
    }

    public async detectLanguage(text: string): Promise<any> {
        return await this.makeRequest(
            "post",
            `${this.entrypoint}/detect/language`,
            JSON.stringify({ text })
        );
    }
}
