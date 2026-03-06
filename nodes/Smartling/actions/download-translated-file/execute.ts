import path from "path";
import {
    DownloadFileWithMetadataParameters,
    FileNameMode,
    RetrievalType
} from "smartling-api-sdk-nodejs";
import { Context } from "../../common/context";

export const executeDownloadTranslatedFile = async (
    ctx: Context,
    projectUid: string,
    fileUri: string,
    targetLocale: string,
    retrievalType?: string,
    includeOriginalStrings?: boolean
): Promise<{ content: Buffer; fileName: string; contentType: string }> => {
    const parameters = new DownloadFileWithMetadataParameters();
    parameters.setFileNameMode(FileNameMode.TRANSFORMED);

    if (retrievalType) {
        parameters.setRetrievalType(retrievalType as RetrievalType);
    }

    if (includeOriginalStrings === true) {
        parameters.includeOriginalStrings();
    } else if (includeOriginalStrings === false) {
        parameters.excludeOriginalStrings();
    }

    ctx.logger.info("Downloading translated file.", {
        projectUid,
        fileUri,
        targetLocale,
        retrievalType,
        includeOriginalStrings
    });

    const filesApi = ctx.getFilesApi();
    const translatedFile = await filesApi.downloadFileWithMetadata(
        projectUid, fileUri, targetLocale, parameters
    );

    const fullFileName = translatedFile.fileName ?? fileUri;
    const parsedFileName = path.parse(fullFileName);

    ctx.logger.info("Download translated file completed successfully.", {
        projectUid,
        fileUri,
        targetLocale,
        fileName: fullFileName
    });

    return {
        content: Buffer.from(translatedFile.fileContent),
        fileName: parsedFileName.base || fullFileName,
        contentType: translatedFile.contentType ?? "application/octet-stream"
    };
};
