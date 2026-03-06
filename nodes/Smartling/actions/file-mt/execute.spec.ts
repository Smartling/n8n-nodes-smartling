import {
    FtsUploadFileParameters,
    TranslateFileParameters,
    LanguageDetectionState,
    MTState,
    SmartlingFileTranslationsApi
} from "smartling-api-sdk-nodejs";
import { Context } from "../../common/context";
import { createContextMock } from "../../../../test/mocks";
import { executeFileMt } from "./execute";

jest.mock("../../common/files/file-type", () => ({
    detectFileType: jest.fn().mockResolvedValue("plain_text")
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { detectFileType } = require("../../common/files/file-type");

describe("executeFileMt", () => {
    let contextMock: Context;
    let fileTranslationsApiMock: jest.Mocked<Pick<
        SmartlingFileTranslationsApi,
        "uploadFile" | "translateFile" | "getTranslationProgress" |
        "downloadTranslatedFileWithMetadata" | "downloadTranslatedFilesWithMetadata" |
        "detectFileLanguage" | "getLanguageDetectionProgress"
    >>;

    const accountUid = "test-account-uid";
    const fileBuffer = Buffer.from("test file content");
    const fileName = "test-file.txt";
    const fileUid = "test-file-uid";
    const mtUid = "test-mt-uid";

    beforeEach(() => {
        jest.clearAllMocks();
        contextMock = createContextMock();
        fileTranslationsApiMock = contextMock.getFileTranslationsApi() as any;

        fileTranslationsApiMock.uploadFile = jest.fn().mockResolvedValue({ fileUid });
        fileTranslationsApiMock.translateFile = jest.fn().mockResolvedValue({ mtUid });
        fileTranslationsApiMock.getTranslationProgress = jest.fn().mockResolvedValue({
            state: MTState.COMPLETED,
            requestedStringCount: 10,
            localeProcessStatuses: []
        });
        fileTranslationsApiMock.downloadTranslatedFileWithMetadata = jest.fn().mockResolvedValue({
            fileName: "translated-file.txt",
            fileContent: "translated content",
            contentType: "text/plain"
        });
        fileTranslationsApiMock.downloadTranslatedFilesWithMetadata = jest.fn().mockResolvedValue({
            fileName: "translations.zip",
            fileContent: "zip content",
            contentType: "application/zip"
        });
    });

    test("full flow: upload -> detect locale -> translate -> poll -> download (single locale)", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.COMPLETED,
            detectedSourceLanguages: [{ defaultLocaleId: "en-US" }]
        });

        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            undefined,
            ["fr-FR"],
            300,
            1
        );

        // Verify upload
        expect(fileTranslationsApiMock.uploadFile).toHaveBeenCalledWith(
            accountUid,
            expect.any(FtsUploadFileParameters)
        );

        // Verify language detection
        expect(fileTranslationsApiMock.detectFileLanguage).toHaveBeenCalledWith(
            accountUid, fileUid
        );
        expect(fileTranslationsApiMock.getLanguageDetectionProgress).toHaveBeenCalledWith(
            accountUid, fileUid, "lang-det-uid"
        );

        // Verify translation
        expect(fileTranslationsApiMock.translateFile).toHaveBeenCalledWith(
            accountUid,
            fileUid,
            expect.any(TranslateFileParameters)
        );

        // Verify polling
        expect(fileTranslationsApiMock.getTranslationProgress).toHaveBeenCalledWith(
            accountUid, fileUid, mtUid
        );

        // Verify download (single locale)
        expect(fileTranslationsApiMock.downloadTranslatedFileWithMetadata).toHaveBeenCalledWith(
            accountUid, fileUid, mtUid, "fr-FR"
        );
        expect(fileTranslationsApiMock.downloadTranslatedFilesWithMetadata).not.toHaveBeenCalled();

        // Verify result
        expect(result).toEqual({
            content: Buffer.from("translated content"),
            fileName: "translated-file.txt",
            contentType: "text/plain",
            metadata: {
                fileUid,
                mtUid,
                targetLocales: ["fr-FR"],
                fullFileName: "translated-file.txt",
                fileName: "translated-file",
                fileExtension: ".txt"
            }
        });
    });

    test("full flow with multiple locales (ZIP download)", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.COMPLETED,
            detectedSourceLanguages: [{ defaultLocaleId: "en-US" }]
        });

        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            undefined,
            ["fr-FR", "es-ES"],
            300,
            1
        );

        // Verify ZIP download for multiple locales
        expect(fileTranslationsApiMock.downloadTranslatedFilesWithMetadata).toHaveBeenCalledWith(
            accountUid, fileUid, mtUid
        );
        expect(fileTranslationsApiMock.downloadTranslatedFileWithMetadata).not.toHaveBeenCalled();

        expect(result).toEqual({
            content: Buffer.from("zip content"),
            fileName: "translations.zip",
            contentType: "application/zip",
            metadata: {
                fileUid,
                mtUid,
                targetLocales: ["fr-FR", "es-ES"],
                fullFileName: "translations.zip",
                fileName: "translations",
                fileExtension: ".zip"
            }
        });
    });

    test("file type auto-detection", async () => {
        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            "en-US",
            ["fr-FR"],
            300,
            1
        );

        expect(detectFileType).toHaveBeenCalledWith(
            contextMock.logger,
            { fileName, content: fileBuffer },
            contextMock.getFileTypeApi()
        );

        expect(result.content).toEqual(Buffer.from("translated content"));
    });

    test("source locale auto-detection", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.COMPLETED,
            detectedSourceLanguages: [{ defaultLocaleId: "de-DE" }]
        });

        await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            undefined,
            ["fr-FR"],
            300,
            1
        );

        expect(fileTranslationsApiMock.detectFileLanguage).toHaveBeenCalledWith(
            accountUid, fileUid
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "Language detected.",
            expect.objectContaining({ sourceLocaleId: "de-DE" })
        );
    });

    test("source locale provided (skip detection)", async () => {
        await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"],
            300,
            1
        );

        expect(fileTranslationsApiMock.detectFileLanguage).not.toHaveBeenCalled();
        expect(fileTranslationsApiMock.getLanguageDetectionProgress).not.toHaveBeenCalled();
    });

    test("file type provided (skip detection)", async () => {
        await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"],
            300,
            1
        );

        expect(detectFileType).not.toHaveBeenCalled();
        expect(contextMock.logger.debug).toHaveBeenCalledWith(
            "Using provided file type.",
            { fileType: "html" }
        );
    });

    test("poll timeout returns last result with non-completed state", async () => {
        fileTranslationsApiMock.getTranslationProgress = jest.fn().mockResolvedValue({
            state: MTState.PROCESSING,
            requestedStringCount: 10,
            localeProcessStatuses: []
        });

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                "en-US",
                ["fr-FR"],
                0.001,
                0.001
            )
        ).rejects.toThrow("File translation did not complete within");
    });

    test("error during upload", async () => {
        const uploadError = new Error("Upload failed");
        fileTranslationsApiMock.uploadFile = jest.fn().mockRejectedValue(uploadError);

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                "en-US",
                ["fr-FR"]
            )
        ).rejects.toThrow("Upload failed");
    });

    test("translation fails with FAILED state", async () => {
        fileTranslationsApiMock.getTranslationProgress = jest.fn().mockResolvedValue({
            state: MTState.FAILED,
            requestedStringCount: 0,
            localeProcessStatuses: []
        });

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                "en-US",
                ["fr-FR"]
            )
        ).rejects.toThrow("File translation failed.");
    });

    test("translation fails with CANCELED state", async () => {
        fileTranslationsApiMock.getTranslationProgress = jest.fn().mockResolvedValue({
            state: MTState.CANCELED,
            requestedStringCount: 0,
            localeProcessStatuses: []
        });

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                "en-US",
                ["fr-FR"]
            )
        ).rejects.toThrow("File translation was canceled.");
    });

    test("language detection failure throws error", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.FAILED,
            detectedSourceLanguages: []
        });

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                undefined,
                ["fr-FR"]
            )
        ).rejects.toThrow("Language detection failed.");
    });

    test("language detection returns empty languages list", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.COMPLETED,
            detectedSourceLanguages: []
        });

        await expect(
            executeFileMt(
                contextMock,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                undefined,
                ["fr-FR"]
            )
        ).rejects.toThrow("Language detection API returned empty list of languages.");
    });

    test("logger calls throughout the flow", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn().mockResolvedValue({
            state: LanguageDetectionState.COMPLETED,
            detectedSourceLanguages: [{ defaultLocaleId: "en-US" }]
        });

        await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            undefined,
            ["fr-FR"],
            300,
            1
        );

        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "File MT translation started.",
            expect.objectContaining({ fileName, targetLocales: ["fr-FR"] })
        );
        expect(contextMock.logger.debug).toHaveBeenCalledWith(
            "File uploading started.",
            expect.objectContaining({ fileName })
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "File successfully uploaded.",
            expect.objectContaining({ fileUid })
        );
        expect(contextMock.logger.debug).toHaveBeenCalledWith(
            "Starting language detection.",
            expect.objectContaining({ fileUid })
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "Language detected.",
            expect.objectContaining({ sourceLocaleId: "en-US" })
        );
        expect(contextMock.logger.debug).toHaveBeenCalledWith(
            "Starting file translation.",
            expect.objectContaining({ fileUid })
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "File translation successfully started.",
            expect.objectContaining({ fileUid, mtUid })
        );
        expect(contextMock.logger.debug).toHaveBeenCalledWith(
            "Polling for translation progress.",
            expect.objectContaining({ fileUid, mtUid })
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "Translation progress polling completed.",
            expect.objectContaining({ fileUid, mtUid, state: MTState.COMPLETED })
        );
    });

    test("uses default fileName when response has no fileName", async () => {
        fileTranslationsApiMock.downloadTranslatedFileWithMetadata = jest.fn().mockResolvedValue({
            fileContent: "translated content",
            contentType: "text/plain"
        });

        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"],
            300,
            1
        );

        expect(result.fileName).toBe("translation");
    });

    test("uses default contentType when response has no contentType", async () => {
        fileTranslationsApiMock.downloadTranslatedFileWithMetadata = jest.fn().mockResolvedValue({
            fileName: "test.txt",
            fileContent: "translated content"
        });

        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"],
            300,
            1
        );

        expect(result.contentType).toBe("application/octet-stream");
    });

    test("language detection polls when queued", async () => {
        fileTranslationsApiMock.detectFileLanguage = jest.fn().mockResolvedValue({
            languageDetectionUid: "lang-det-uid"
        });
        fileTranslationsApiMock.getLanguageDetectionProgress = jest.fn()
            .mockResolvedValueOnce({
                state: LanguageDetectionState.QUEUED,
                detectedSourceLanguages: []
            })
            .mockResolvedValueOnce({
                state: LanguageDetectionState.COMPLETED,
                detectedSourceLanguages: [{ defaultLocaleId: "en-US" }]
            });

        const result = await executeFileMt(
            contextMock,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            undefined,
            ["fr-FR"],
            300,
            1
        );

        expect(fileTranslationsApiMock.getLanguageDetectionProgress).toHaveBeenCalledTimes(2);
        expect(result.content).toEqual(Buffer.from("translated content"));
    });
});
