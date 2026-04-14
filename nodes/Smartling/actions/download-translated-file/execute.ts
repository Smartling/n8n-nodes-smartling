import { smartlingRequest } from "../../common/smartling-api";
import { parseFileName } from "../../common/file-utils";

export interface DownloadResult {
    content: Buffer;
    fileName: string;
    contentType: string;
}

export const executeDownloadTranslatedFile = async (
    context: any,
    projectUid: string,
    fileUri: string,
    targetLocale: string,
    retrievalType: string | undefined,
    includeOriginalStrings: boolean
): Promise<DownloadResult> => {
    const qs: Record<string, string> = {
        fileUri,
    };
    if (retrievalType) {
        qs.retrievalType = retrievalType;
    }
    if (includeOriginalStrings) {
        qs.includeOriginalStrings = "true";
    }

    const response = await smartlingRequest(context, {
        method: "GET",
        path: `/files-api/v2/projects/${projectUid}/locales/${targetLocale}/file`,
        qs,
        encoding: "arraybuffer",
        returnFullResponse: true,
    });

    const contentDisposition = (response.headers?.["content-disposition"] ?? "") as string;
    const fileNameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const parsed = parseFileName(fileNameMatch?.[1] ?? fileUri);

    return {
        content: Buffer.from(response.body as ArrayBuffer),
        fileName: parsed.base,
        contentType: (response.headers?.["content-type"] ?? "application/octet-stream") as string,
    };
};
