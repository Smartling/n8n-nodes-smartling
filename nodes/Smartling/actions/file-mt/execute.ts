import { smartlingRequest } from "../../common/smartling-api";
import { detectFileType, type FileContentForDetection } from "../../common/files";
import { FileType } from "../../common/files";
import { parseFileName } from "../../common/file-utils";

export interface FileMtResult {
    content: Buffer;
    fileName: string;
    contentType: string;
    metadata: Record<string, unknown>;
}

const detectFileTypeIfRequired = async (
    context: any,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string | undefined
): Promise<FileType> => {
    if (fileType) return fileType as FileType;
    const fileContent: FileContentForDetection = { fileName, content: fileBuffer };
    return detectFileType(context, fileContent);
};

const uploadFile = async (
    context: any,
    accountUid: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: FileType
): Promise<string> => {
    const boundary = "----n8nSmartlingUpload" + Date.now().toString(36);
    const requestJson = JSON.stringify({ fileName, fileType });

    const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="request"\r\nContent-Type: application/json\r\n\r\n${requestJson}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ];

    const body = Buffer.concat([
        Buffer.from(parts[0]),
        Buffer.from(parts[1]),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const result = await smartlingRequest(context, {
        method: "POST",
        path: `/file-translations-api/v2/accounts/${accountUid}/files`,
        body,
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    });

    return result.fileUid;
};

const detectSourceLocale = async (
    context: any,
    accountUid: string,
    fileUid: string
): Promise<string> => {
    const startResult = await smartlingRequest(context, {
        method: "POST",
        path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/language-detection`,
        body: {},
    });

    const progress = await smartlingRequest(context, {
        method: "GET",
        path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/language-detection/${startResult.languageDetectionUid}/status`,
    });

    if (progress.state === "COMPLETED" && progress.detectedSourceLanguages?.length) {
        return progress.detectedSourceLanguages[0].defaultLocaleId;
    }

    if (progress.state === "FAILED") {
        throw new Error("Language detection failed.");
    }

    throw new Error(
        "Language detection did not complete immediately. Please specify source locale manually."
    );
};

const startTranslation = async (
    context: any,
    accountUid: string,
    fileUid: string,
    sourceLocale: string,
    targetLocales: string[]
): Promise<string> => {
    const result = await smartlingRequest(context, {
        method: "POST",
        path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt`,
        body: { sourceLocaleId: sourceLocale, targetLocaleIds: targetLocales },
    });

    return result.mtUid;
};

const downloadResult = async (
    context: any,
    accountUid: string,
    fileUid: string,
    mtUid: string,
    targetLocales: string[]
): Promise<FileMtResult> => {
    const dlPath = targetLocales.length > 1
        ? `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/locales/all/file/zip`
        : `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/locales/${targetLocales[0]}/file`;

    const response = await smartlingRequest(context, {
        method: "GET",
        path: dlPath,
        encoding: "arraybuffer",
        returnFullResponse: true,
    });

    const contentDisposition = (response.headers?.["content-disposition"] ?? "") as string;
    const fileNameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const fullFileName = fileNameMatch?.[1] ?? "translation";
    const parsed = parseFileName(fullFileName);

    return {
        content: Buffer.from(response.body as ArrayBuffer),
        fileName: fullFileName,
        contentType: (response.headers?.["content-type"] ?? "application/octet-stream") as string,
        metadata: {
            fileUid,
            mtUid,
            targetLocales,
            fullFileName,
            fileName: parsed.name,
            fileExtension: parsed.ext,
        },
    };
};

export const executeFileMt = async (
    context: any,
    accountUid: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string | undefined,
    sourceLocale: string | undefined,
    targetLocales: string[]
): Promise<FileMtResult> => {
    const detectedFileType = await detectFileTypeIfRequired(context, fileBuffer, fileName, fileType);
    const fileUid = await uploadFile(context, accountUid, fileBuffer, fileName, detectedFileType);
    const resolvedSourceLocale = sourceLocale || await detectSourceLocale(context, accountUid, fileUid);
    const mtUid = await startTranslation(context, accountUid, fileUid, resolvedSourceLocale, targetLocales);

    // Check status once (no polling — setTimeout is banned)
    const statusResult = await smartlingRequest(context, {
        method: "GET",
        path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/status`,
    });

    if (statusResult.state === "COMPLETED") {
        return downloadResult(context, accountUid, fileUid, mtUid, targetLocales);
    }

    if (statusResult.state === "FAILED") {
        throw new Error("File translation failed.");
    }

    if (statusResult.state === "CANCELED") {
        throw new Error("File translation was canceled.");
    }

    // Still in progress — return metadata
    const parsed = parseFileName(fileName);
    return {
        content: Buffer.alloc(0),
        fileName: "",
        contentType: "",
        metadata: {
            fileUid,
            mtUid,
            targetLocales,
            state: statusResult.state,
            message: "Translation is still in progress. Use the fileUid and mtUid to check status or download later.",
            fullFileName: fileName,
            fileName: parsed.name,
            fileExtension: parsed.ext,
        },
    };
};
