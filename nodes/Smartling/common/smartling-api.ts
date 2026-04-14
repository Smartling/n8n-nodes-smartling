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
    const isJsonBody = options.body !== undefined && !(options.body instanceof Buffer);
    const isBinaryResponse = options.encoding === "arraybuffer";

    const requestOptions: IHttpRequestOptions = {
        method: options.method,
        url: `${API_URL}${options.path}`,
        json: isJsonBody && !isBinaryResponse,
    };

    if (options.body) {
        if (isJsonBody) {
            requestOptions.body = options.body;
        } else {
            requestOptions.body = options.body;
        }
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

    try {
        const response = await context.helpers.httpRequestWithAuthentication.call(
            context,
            "smartlingApi",
            requestOptions
        );

        // For binary/full responses, return as-is (caller needs headers)
        if (options.returnFullResponse) {
            return response;
        }

        // Smartling wraps responses in { response: { code: "SUCCESS", data: ... } }
        if (response?.response?.data !== undefined) {
            return response.response.data;
        }
        return response;
    } catch (error: any) {
        // Try every known location for the API response body
        const responseBody = error.cause?.response?.body
            ?? error.response?.body
            ?? error.body
            ?? error.cause?.body
            ?? error.description
            ?? error.cause?.description;

        let detail = "";
        if (responseBody) {
            if (Buffer.isBuffer(responseBody) || responseBody?.type === "Buffer") {
                detail = Buffer.from(responseBody.data ?? responseBody).toString("utf-8");
            } else if (typeof responseBody === "string") {
                detail = responseBody;
            } else {
                detail = JSON.stringify(responseBody);
            }
        }

        // Always include the method + path for debugging
        const msg = detail
            ? `Smartling API error on ${options.method} ${options.path}: ${detail}`
            : `Smartling API error on ${options.method} ${options.path}: ${error.message}`;
        throw new Error(msg);
    }
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
