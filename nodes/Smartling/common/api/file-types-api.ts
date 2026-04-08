import FormData from "form-data";
import { SmartlingBaseApi, BaseParameters, Logger, AccessTokenProvider } from "smartling-api-sdk-nodejs";

export class IdentifyFileTypeParameters extends BaseParameters {
    setFileContentFromBuffer(fileContent: Buffer): IdentifyFileTypeParameters {
        this.set("file", fileContent);
        return this;
    }

    setFileName(fileName: string): IdentifyFileTypeParameters {
        this.set("fileName", fileName);
        return this;
    }
}

export class SmartlingFileTypesApi extends SmartlingBaseApi {
    constructor(smartlingApiBaseUrl: string, authApi: AccessTokenProvider, logger: Logger) {
        super(logger);
        this.authApi = authApi;
        this.entrypoint = `${smartlingApiBaseUrl}/filetype/v2`;
    }

    public async indentifyFileType(parameters: IdentifyFileTypeParameters): Promise<any> {
        const formData = new FormData();
        const exported = parameters.export();
        formData.append("file", exported.file, exported.fileName ?? "unknown");

        return await this.makeRequest(
            "post",
            `${this.entrypoint}/identify`,
            formData,
            false,
            SmartlingFileTypesApi.fixContentTypeHeaderCase(formData)
        );
    }

    static fixContentTypeHeaderCase(form: FormData): Record<string, unknown> {
        const headers = form.getHeaders();
        headers["Content-Type"] = headers["content-type"];
        delete headers["content-type"];
        return headers;
    }
}
