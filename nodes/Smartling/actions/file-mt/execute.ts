import path from "path";
import {
    FtsUploadFileParameters,
    TranslateFileParameters,
    LanguageDetectionState,
    MTState,
    FileType as SdkFileType
} from "smartling-api-sdk-nodejs";
import { Context } from "../../common/context";
import { pollUntil } from "../../common/utils";
import { detectFileType, type FileContentForDetection } from "../../common/files";
import { FileType } from "../../common/files";
import {
    DEFAULT_POLL_INTERVAL_SECONDS,
    DEFAULT_POLL_TIMEOUT_SECONDS,
    FILE_LANGUAGE_DETECTION_WAIT_TIME_MS
} from "../../common/constants";

export interface FileMtResult {
    content: Buffer;
    fileName: string;
    contentType: string;
    metadata: Record<string, unknown>;
}

const detectFileTypeIfRequired = async (
    ctx: Context,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string | undefined
): Promise<FileType> => {
    if (fileType) {
        ctx.logger.debug("Using provided file type.", { fileType });
        return fileType as FileType;
    }

    const fileContent: FileContentForDetection = {
        fileName,
        content: fileBuffer
    };

    return detectFileType(ctx.logger, fileContent, ctx.getFileTypeApi());
};

const uploadFile = async (
    ctx: Context,
    accountUid: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: FileType
): Promise<string> => {
    const fileUploadParameters = new FtsUploadFileParameters()
        .setFileContentFromBuffer(fileBuffer)
        .setFileName(fileName)
        .setFileType(fileType as unknown as SdkFileType);

    ctx.logger.debug("File uploading started.", {
        fileName,
        fileType
    });

    const result = await ctx.getFileTranslationsApi().uploadFile(
        accountUid, fileUploadParameters
    );

    ctx.logger.info("File successfully uploaded.", {
        fileName,
        fileType,
        fileUid: result.fileUid
    });

    return result.fileUid;
};

const detectSourceLocale = async (
    ctx: Context,
    accountUid: string,
    fileUid: string
): Promise<string> => {
    ctx.logger.debug("Starting language detection.", { fileUid });

    const fileTranslationApi = ctx.getFileTranslationsApi();
    const languageDetectionStartResult = await fileTranslationApi.detectFileLanguage(
        accountUid, fileUid
    );

    ctx.logger.debug("Language detection started.", {
        fileUid,
        languageDetectionUid: languageDetectionStartResult.languageDetectionUid
    });

    let languageDetectionState = LanguageDetectionState.QUEUED;
    while (languageDetectionState === LanguageDetectionState.QUEUED) {
        const languageDetectionProgress = await fileTranslationApi.getLanguageDetectionProgress(
            accountUid, fileUid, languageDetectionStartResult.languageDetectionUid
        );
        languageDetectionState = languageDetectionProgress.state;

        ctx.logger.debug("Language detection progress.", {
            fileUid,
            languageDetectionUid: languageDetectionStartResult.languageDetectionUid,
            state: languageDetectionState
        });

        switch (languageDetectionState) {
            case LanguageDetectionState.FAILED:
                throw new Error("Language detection failed.");
            case LanguageDetectionState.COMPLETED:
                if (!languageDetectionProgress.detectedSourceLanguages.length) {
                    throw new Error("Language detection API returned empty list of languages.");
                }
                ctx.logger.info("Language detected.", {
                    fileUid,
                    languageDetectionUid: languageDetectionStartResult.languageDetectionUid,
                    sourceLocaleId: languageDetectionProgress.detectedSourceLanguages[0].defaultLocaleId
                });
                return languageDetectionProgress.detectedSourceLanguages[0].defaultLocaleId;
            case LanguageDetectionState.QUEUED:
            default:
                await new Promise(resolve => {
                    setTimeout(resolve, FILE_LANGUAGE_DETECTION_WAIT_TIME_MS);
                });
        }
    }

    throw new Error("Language detection ended in unexpected state.");
};

const startTranslation = async (
    ctx: Context,
    accountUid: string,
    fileUid: string,
    sourceLocale: string,
    targetLocales: string[]
): Promise<string> => {
    ctx.logger.debug("Starting file translation.", {
        fileUid,
        sourceLocale,
        targetLocales
    });

    const translateFileParameters = new TranslateFileParameters()
        .setSourceLocaleId(sourceLocale)
        .setTargetLocaleIds(targetLocales);

    const result = await ctx.getFileTranslationsApi().translateFile(
        accountUid, fileUid, translateFileParameters
    );

    ctx.logger.info("File translation successfully started.", {
        fileUid,
        sourceLocale,
        targetLocales,
        mtUid: result.mtUid
    });

    return result.mtUid;
};

const waitForTranslation = async (
    ctx: Context,
    accountUid: string,
    fileUid: string,
    mtUid: string,
    timeout: number,
    pollInterval: number
): Promise<MTState> => {
    ctx.logger.debug("Polling for translation progress.", { fileUid, mtUid });

    const result = await pollUntil(
        () => ctx.getFileTranslationsApi().getTranslationProgress(accountUid, fileUid, mtUid),
        {
            delayBetweenAttempts: pollInterval * 1000,
            maxDuration: timeout * 1000,
            exitCondition: (progress) =>
                progress.state === MTState.COMPLETED
                || progress.state === MTState.FAILED
                || progress.state === MTState.CANCELED,
            returnLastOnTimeout: true,
            log: (msg) => ctx.logger.debug(msg)
        }
    );

    ctx.logger.info("Translation progress polling completed.", {
        fileUid,
        mtUid,
        state: result.state
    });

    return result.state;
};

const downloadResult = async (
    ctx: Context,
    accountUid: string,
    fileUid: string,
    mtUid: string,
    targetLocales: string[]
): Promise<FileMtResult> => {
    const fileTranslationApi = ctx.getFileTranslationsApi();

    ctx.logger.debug("Downloading translated file(s).", {
        fileUid,
        mtUid,
        targetLocales
    });

    const translatedFile = targetLocales.length > 1
        ? await fileTranslationApi.downloadTranslatedFilesWithMetadata(
            accountUid, fileUid, mtUid
        )
        : await fileTranslationApi.downloadTranslatedFileWithMetadata(
            accountUid, fileUid, mtUid, targetLocales[0]
        );

    const fullFileName = translatedFile.fileName ?? "translation";
    const parsedFileName = path.parse(fullFileName);

    ctx.logger.info(
        targetLocales.length > 1
            ? "Downloading of Zip archive is completed."
            : `Downloading of the file translated to locale=${targetLocales[0]} completed.`,
        {
            fileUid,
            mtUid,
            targetLocales,
            fileName: fullFileName
        }
    );

    return {
        content: Buffer.from(translatedFile.fileContent),
        fileName: fullFileName,
        contentType: translatedFile.contentType ?? "application/octet-stream",
        metadata: {
            fileUid,
            mtUid,
            targetLocales,
            fullFileName,
            fileName: parsedFileName.name,
            fileExtension: parsedFileName.ext
        }
    };
};

export const executeFileMt = async (
    ctx: Context,
    accountUid: string,
    fileBuffer: Buffer,
    fileName: string,
    fileType: string | undefined,
    sourceLocale: string | undefined,
    targetLocales: string[],
    timeout: number = DEFAULT_POLL_TIMEOUT_SECONDS,
    pollInterval: number = DEFAULT_POLL_INTERVAL_SECONDS
): Promise<FileMtResult> => {
    ctx.logger.info("File MT translation started.", {
        fileName,
        fileType,
        sourceLocale,
        targetLocales
    });

    // 1. Detect file type if not provided
    const detectedFileType = await detectFileTypeIfRequired(ctx, fileBuffer, fileName, fileType);

    // 2. Upload file
    const fileUid = await uploadFile(ctx, accountUid, fileBuffer, fileName, detectedFileType);

    // 3. Detect source locale if not provided
    const resolvedSourceLocale = sourceLocale || await detectSourceLocale(ctx, accountUid, fileUid);

    // 4. Start translation
    const mtUid = await startTranslation(ctx, accountUid, fileUid, resolvedSourceLocale, targetLocales);

    // 5. Poll for completion
    const finalState = await waitForTranslation(ctx, accountUid, fileUid, mtUid, timeout, pollInterval);

    if (finalState === MTState.FAILED) {
        throw new Error("File translation failed.");
    }

    if (finalState === MTState.CANCELED) {
        throw new Error("File translation was canceled.");
    }

    if (finalState !== MTState.COMPLETED) {
        throw new Error(`File translation did not complete within ${timeout} seconds.`);
    }

    // 6. Download translated file(s)
    return downloadResult(ctx, accountUid, fileUid, mtUid, targetLocales);
};
