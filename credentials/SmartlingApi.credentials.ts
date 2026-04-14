import type {
    ICredentialType,
    INodeProperties,
    ICredentialDataDecryptedObject,
    IHttpRequestOptions,
    IHttpRequestHelper,
    IDataObject,
} from "n8n-workflow";

const API_URL = "https://api.smartling.com";

export class SmartlingApi implements ICredentialType {
    name = "smartlingApi";
    displayName = "Smartling API";
    icon = { light: "file:smartling.svg", dark: "file:smartling.svg" } as const;
    documentationUrl = "https://help.smartling.com/hc/en-us/articles/115003028634-API";

    properties: INodeProperties[] = [
        {
            displayName: "User Identifier",
            name: "userIdentifier",
            type: "string",
            default: "",
            required: true,
            description:
                "API User Identifier from Smartling Dashboard > Account Settings > API",
        },
        {
            displayName: "User Secret",
            name: "userSecret",
            type: "string",
            typeOptions: { password: true },
            default: "",
            required: true,
            description: "API Token Secret from Smartling Dashboard",
        },
    ];

    async preAuthentication(
        this: IHttpRequestHelper,
        credentials: ICredentialDataDecryptedObject
    ): Promise<IDataObject> {
        const response = (await this.helpers.httpRequest({
            method: "POST",
            url: `${API_URL}/auth-api/v2/authenticate`,
            body: {
                userIdentifier: credentials.userIdentifier,
                userSecret: credentials.userSecret,
            },
            json: true,
        })) as IDataObject;

        const data = (response as any).response?.data ?? response;
        return {
            accessToken: data.accessToken as string,
        };
    }

    authenticate: ICredentialType["authenticate"] = async (
        credentials: ICredentialDataDecryptedObject,
        requestOptions: IHttpRequestOptions
    ): Promise<IHttpRequestOptions> => {
        requestOptions.headers = {
            ...requestOptions.headers,
            Authorization: `Bearer ${credentials.accessToken}`,
        };
        return requestOptions;
    };

    test = {
        request: {
            method: "GET" as const,
            url: `${API_URL}/accounts-api/v2/accounts?limit=1`,
        },
    };
}
