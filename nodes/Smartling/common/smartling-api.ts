import type { IHttpRequestOptions, IAllExecuteFunctions } from "n8n-workflow";
import { API_URL } from "./constants";

export interface SmartlingRequestOptions {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    body?: object | Buffer;
    qs?: Record<string, string | number | boolean>;
    headers?: Record<string, string>;
    encoding?: "arraybuffer" | "json" | "text";
    returnFullResponse?: boolean;
}

export async function smartlingRequest(
    context: any,
    options: SmartlingRequestOptions
): Promise<any> {
    const requestOptions: IHttpRequestOptions = {
        method: options.method,
        url: `${API_URL}${options.path}`,
        json: options.body instanceof Buffer ? false : true,
    };

    if (options.body) {
        requestOptions.body = options.body;
    }
    if (options.qs) {
        requestOptions.qs = options.qs as any;
    }
    if (options.headers) {
        requestOptions.headers = { ...requestOptions.headers, ...options.headers };
    }
    if (options.encoding) {
        requestOptions.encoding = options.encoding;
    }
    if (options.returnFullResponse) {
        requestOptions.returnFullResponse = true;
    }

    const response = await context.helpers.httpRequestWithAuthentication.call(
        context,
        "smartlingApi",
        requestOptions
    );

    // Smartling wraps responses in { response: { code: "SUCCESS", data: ... } }
    if (response?.response?.data !== undefined) {
        return response.response.data;
    }
    return response;
}

export async function resolveAccountUid(context: any): Promise<string> {
    const result = await smartlingRequest(context, {
        method: "GET",
        path: "/accounts-api/v2/accounts",
        qs: { limit: 1 },
    });
    const accounts = result?.accounts ?? result?.items;
    if (!accounts?.length) {
        throw new Error("No Smartling account found for these credentials");
    }
    return accounts[0].accountUid;
}
