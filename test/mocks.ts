import { IExecuteFunctions, IHookFunctions, IWebhookFunctions } from "n8n-workflow";

export const createExecuteFunctionsMock = (): IExecuteFunctions => {
    return {
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-uid",
            userSecret: "test-secret"
        }),
        getNodeParameter: jest.fn(),
        getInputData: jest.fn().mockReturnValue([{ json: {} }]),
        getNode: jest.fn().mockReturnValue({ name: "Smartling", type: "smartling" }),
        helpers: {
            returnJsonArray: (items: any) => {
                if (Array.isArray(items)) {
                    return items.map((item) => ({ json: item }));
                }
                return [{ json: items }];
            },
            httpRequest: jest.fn(),
            getBinaryDataBuffer: jest.fn(),
            prepareBinaryData: jest.fn()
        },
        continueOnFail: jest.fn().mockReturnValue(false)
    } as unknown as IExecuteFunctions;
};

export const createHookFunctionsMock = (): IHookFunctions => {
    const staticData: Record<string, unknown> = {};

    return {
        getCredentials: jest.fn().mockResolvedValue({
            userIdentifier: "test-uid",
            userSecret: "test-secret"
        }),
        getNodeParameter: jest.fn(),
        getNodeWebhookUrl: jest.fn().mockReturnValue("https://n8n.test/webhook/test-id"),
        getWorkflowStaticData: jest.fn().mockReturnValue(staticData)
    } as unknown as IHookFunctions;
};

export const createWebhookFunctionsMock = (): IWebhookFunctions => {
    return {
        getBodyData: jest.fn(),
        getHeaderData: jest.fn(),
        getQueryData: jest.fn(),
        helpers: {
            returnJsonArray: (items: any) => {
                if (Array.isArray(items)) {
                    return items.map((item) => ({ json: item }));
                }
                return [{ json: items }];
            }
        }
    } as unknown as IWebhookFunctions;
};
