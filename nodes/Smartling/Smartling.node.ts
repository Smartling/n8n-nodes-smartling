import type {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    INodeListSearchResult,
    ICredentialTestFunctions,
    INodeCredentialTestResult,
    ICredentialsDecrypted,
} from "n8n-workflow";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";

import { wrapAndLogError } from "./common/errors";

import { textMtDescription } from "./actions/text-mt/description";
import { executeTextMt } from "./actions/text-mt/execute";
import { fileMtDescription } from "./actions/file-mt/description";
import { executeFileMt } from "./actions/file-mt/execute";
import { downloadTranslatedFileDescription } from "./actions/download-translated-file/description";
import { executeDownloadTranslatedFile } from "./actions/download-translated-file/execute";
import { requestTranslationDescription } from "./actions/request-translation/description";
import { executeRequestTranslation, type RequestTranslationParams } from "./actions/request-translation/execute";
import { createContext } from "./common/context";
import { getMtLocales, getProjectLocales, getProjectWorkflows } from "./methods/load-options";
import { searchProjects } from "./methods/list-search";

const NODE_VERSION = "0.1.0";

export class Smartling implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Smartling",
        name: "smartling",
        icon: "file:smartling.svg",
        group: ["input"],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: "Interact with Smartling translation management",
        defaults: { name: "Smartling" },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        credentials: [
            {
                name: "smartlingApi",
                required: true,
                testedBy: "smartlingApiTest",
            },
        ],
        properties: [
            // Resource selector
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                options: [
                    { name: "Machine Translation", value: "machineTranslation" },
                    { name: "Translation", value: "translation" },
                    { name: "File", value: "file" },
                ],
                default: "machineTranslation",
            },
            // Operation selectors (one per resource)
            // Machine Translation operations
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: { show: { resource: ["machineTranslation"] } },
                options: [
                    {
                        name: "Translate Text via Machine Translation",
                        value: "translateText",
                        action: "Translate text via machine translation",
                        description: "Machine translate text using MT profile",
                    },
                    {
                        name: "Translate File via Machine Translation",
                        value: "translateFile",
                        action: "Translate file via machine translation",
                        description: "Machine translate file using MT profile",
                    },
                ],
                default: "translateText",
            },
            // Translation operations
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: { show: { resource: ["translation"] } },
                options: [
                    {
                        name: "Request Translation",
                        value: "requestTranslation",
                        action: "Request translation",
                        description: "Upload a file to a daily job to request its translation",
                    },
                ],
                default: "requestTranslation",
            },
            // File operations
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: { show: { resource: ["file"] } },
                options: [
                    {
                        name: "Download Translated File",
                        value: "download",
                        action: "Download translated file",
                        description: "Download translated file for target locale",
                    },
                ],
                default: "download",
            },
            // All field definitions from each action
            ...textMtDescription,
            ...fileMtDescription,
            ...downloadTranslatedFileDescription,
            ...requestTranslationDescription,
        ],
    };

    methods = {
        credentialTest: {
            async smartlingApiTest(
                this: ICredentialTestFunctions,
                credential: ICredentialsDecrypted,
            ): Promise<INodeCredentialTestResult> {
                try {
                    const creds = credential.data!;
                    const ctx = createContext(
                        {
                            userIdentifier: creds.userIdentifier as string,
                            userSecret: creds.userSecret as string,
                        },
                        "credentialTest",
                        NODE_VERSION,
                    );
                    await ctx.resolveAccountUid();
                    return {
                        status: "OK",
                        message: "Successfully connected to Smartling",
                    };
                } catch (error) {
                    return {
                        status: "Error",
                        message: `Authentication failed: ${(error as Error).message}`,
                    };
                }
            },
        },
        loadOptions: {
            getMtLocales,
            getProjectLocales,
            getProjectWorkflows,
        },
        listSearch: {
            searchProjects,
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const resource = this.getNodeParameter("resource", 0) as string;
        const operation = this.getNodeParameter("operation", 0) as string;

        for (let i = 0; i < items.length; i++) {
            try {
                const credentials = await this.getCredentials("smartlingApi");
                const ctx = createContext(
                    {
                        userIdentifier: credentials.userIdentifier as string,
                        userSecret: credentials.userSecret as string,
                    },
                    `${resource}.${operation}`,
                    NODE_VERSION,
                );

                try {
                    if (resource === "machineTranslation" && operation === "translateText") {
                        const accountUid = await ctx.resolveAccountUid();
                        const sourceLocale = this.getNodeParameter("sourceLocale", i) as string;
                        const targetLocale = this.getNodeParameter("targetLocale", i) as string;
                        const sourceText = this.getNodeParameter("sourceText", i) as string;

                        const result = await executeTextMt(
                            ctx,
                            accountUid,
                            sourceLocale || undefined,
                            targetLocale,
                            sourceText,
                        );

                        returnData.push({ json: result as IDataObject, pairedItem: i });
                    } else if (resource === "machineTranslation" && operation === "translateFile") {
                        const accountUid = await ctx.resolveAccountUid();
                        const binaryPropertyName = this.getNodeParameter(
                            "binaryPropertyName",
                            i,
                        ) as string;
                        const fileType = this.getNodeParameter("fileType", i) as string;
                        const sourceLocale = this.getNodeParameter("sourceLocale", i) as string;
                        const targetLocales = this.getNodeParameter(
                            "targetLocales",
                            i,
                        ) as string[];
                        const timeout = this.getNodeParameter("timeout", i) as number;
                        const pollInterval = this.getNodeParameter("pollInterval", i) as number;

                        const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
                        const fileBuffer = await this.helpers.getBinaryDataBuffer(
                            i,
                            binaryPropertyName,
                        );
                        const fileName = binaryData.fileName ?? "file";

                        const result = await executeFileMt(
                            ctx,
                            accountUid,
                            fileBuffer,
                            fileName,
                            fileType || undefined,
                            sourceLocale || undefined,
                            targetLocales,
                            timeout,
                            pollInterval,
                        );

                        const binary = await this.helpers.prepareBinaryData(
                            result.content,
                            result.fileName,
                            result.contentType,
                        );

                        returnData.push({
                            json: result.metadata as IDataObject,
                            binary: { data: binary },
                            pairedItem: i,
                        });
                    } else if (resource === "file" && operation === "download") {
                        const projectUidParam = this.getNodeParameter("projectUid", i) as {
                            value: string;
                        };
                        const projectUid =
                            projectUidParam.value || (projectUidParam as unknown as string);
                        const fileUri = this.getNodeParameter("fileUri", i) as string;
                        const targetLocale = this.getNodeParameter("targetLocale", i) as string;
                        const retrievalType = this.getNodeParameter(
                            "retrievalType",
                            i,
                        ) as string;
                        const includeOriginalStrings = this.getNodeParameter(
                            "includeOriginalStrings",
                            i,
                        ) as boolean;

                        const result = await executeDownloadTranslatedFile(
                            ctx,
                            projectUid,
                            fileUri,
                            targetLocale,
                            retrievalType || undefined,
                            includeOriginalStrings,
                        );

                        const binary = await this.helpers.prepareBinaryData(
                            result.content,
                            result.fileName,
                            result.contentType,
                        );

                        returnData.push({
                            json: { fileName: result.fileName, contentType: result.contentType },
                            binary: { data: binary },
                            pairedItem: i,
                        });
                    } else if (resource === "translation" && operation === "requestTranslation") {
                        const accountUid = await ctx.resolveAccountUid();
                        const projectUidParam = this.getNodeParameter("projectUid", i) as {
                            value: string;
                        };
                        const projectUid =
                            projectUidParam.value || (projectUidParam as unknown as string);
                        const dailyJobType = this.getNodeParameter("dailyJobType", i) as string;
                        const dailyJobNamePrefix = this.getNodeParameter(
                            "dailyJobNamePrefix",
                            i,
                            "",
                        ) as string;
                        const jobReferenceNumber = this.getNodeParameter(
                            "jobReferenceNumber",
                            i,
                            "",
                        ) as string;
                        const targetLocales = this.getNodeParameter(
                            "targetLocales",
                            i,
                        ) as string[];
                        const translationJobAuthorize = this.getNodeParameter(
                            "translationJobAuthorize",
                            i,
                        ) as boolean;
                        const targetLanguageWorkflow = this.getNodeParameter(
                            "targetLanguageWorkflow",
                            i,
                            "",
                        ) as string;
                        const binaryPropertyName = this.getNodeParameter(
                            "binaryPropertyName",
                            i,
                        ) as string;
                        const fileUri = this.getNodeParameter("fileUri", i) as string;
                        const fileType = this.getNodeParameter("fileType", i, "") as string;

                        const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
                        const fileBuffer = await this.helpers.getBinaryDataBuffer(
                            i,
                            binaryPropertyName,
                        );
                        const fileName = binaryData.fileName ?? "file";

                        const params: RequestTranslationParams = {
                            projectUid,
                            accountUid,
                            dailyJobType,
                            dailyJobNamePrefix: dailyJobNamePrefix || undefined,
                            jobReferenceNumber: jobReferenceNumber || undefined,
                            targetLocales,
                            translationJobAuthorize,
                            targetLanguageWorkflow: targetLanguageWorkflow || undefined,
                            fileBuffer,
                            fileName,
                            fileUri,
                            fileType: fileType || undefined,
                        };

                        const result = await executeRequestTranslation(ctx, params);

                        returnData.push({ json: result as IDataObject, pairedItem: i });
                    } else {
                        throw new NodeOperationError(
                            this.getNode(),
                            `Unknown resource/operation: ${resource}/${operation}`,
                            { itemIndex: i },
                        );
                    }
                } catch (error) {
                    throw wrapAndLogError(
                        ctx,
                        this.getNode(),
                        error,
                        `Smartling ${resource}.${operation} failed`,
                    );
                } finally {
                    await ctx.logger.flush();
                }
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: (error as Error).message },
                        pairedItem: i,
                    });
                } else {
                    throw error;
                }
            }
        }

        return [returnData];
    }
}
