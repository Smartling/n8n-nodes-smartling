import { executeFileMt } from "./execute";

jest.mock("../../common/smartling-api", () => ({
    smartlingRequest: jest.fn()
}));

jest.mock("../../common/files/file-type", () => ({
    detectFileType: jest.fn().mockResolvedValue("plain_text")
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { smartlingRequest } = require("../../common/smartling-api");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { detectFileType } = require("../../common/files/file-type");

const accountUid = "test-account-uid";
const fileBuffer = Buffer.from("test file content");
const fileName = "test-file.txt";
const fileUid = "test-file-uid";
const mtUid = "test-mt-uid";

const context = { helpers: {} };

function mockSmartlingRequest(overrides: Record<string, any> = {}) {
    smartlingRequest.mockImplementation((_ctx: any, opts: any) => {
        const path: string = opts.path;

        // Upload file
        if (path.endsWith("/files") && opts.method === "POST") {
            return Promise.resolve(overrides["upload"] ?? { fileUid });
        }

        // Start language detection
        if (path.includes("/language-detection") && opts.method === "POST") {
            return Promise.resolve(overrides["langDetectStart"] ?? { languageDetectionUid: "lang-det-uid" });
        }

        // Language detection status
        if (path.includes("/language-detection/") && path.includes("/status")) {
            return Promise.resolve(overrides["langDetectStatus"] ?? {
                state: "COMPLETED",
                detectedSourceLanguages: [{ defaultLocaleId: "en-US" }]
            });
        }

        // Start translation
        if (path.includes("/mt") && opts.method === "POST" && !path.includes("/status")) {
            return Promise.resolve(overrides["translateStart"] ?? { mtUid });
        }

        // Translation status
        if (path.includes("/mt/") && path.endsWith("/status")) {
            return Promise.resolve(overrides["translateStatus"] ?? { state: "COMPLETED" });
        }

        // Download file
        if (path.includes("/mt/") && path.includes("/file")) {
            return Promise.resolve(overrides["download"] ?? {
                body: Buffer.from("translated content"),
                headers: {
                    "content-disposition": 'attachment; filename="translated-file.txt"',
                    "content-type": "text/plain"
                }
            });
        }

        return Promise.resolve({});
    });
}

describe("executeFileMt", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("full flow: upload -> detect locale -> translate -> check status -> download (single locale)", async () => {
        mockSmartlingRequest();

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            undefined,
            ["fr-FR"]
        );

        // Verify upload was called
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "POST",
                path: `/file-translations-api/v2/accounts/${accountUid}/files`
            })
        );

        // Verify language detection start
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "POST",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/language-detection`
            })
        );

        // Verify language detection status
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "GET",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/language-detection/lang-det-uid/status`
            })
        );

        // Verify translation start
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "POST",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt`,
                body: { sourceLocaleId: "en-US", targetLocaleIds: ["fr-FR"] }
            })
        );

        // Verify status check
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "GET",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/status`
            })
        );

        // Verify single locale download
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "GET",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/locales/fr-FR/file`
            })
        );

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
        mockSmartlingRequest({
            download: {
                body: Buffer.from("zip content"),
                headers: {
                    "content-disposition": 'attachment; filename="translations.zip"',
                    "content-type": "application/zip"
                }
            }
        });

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            undefined,
            ["fr-FR", "es-ES"]
        );

        // Verify ZIP download path
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                method: "GET",
                path: `/file-translations-api/v2/accounts/${accountUid}/files/${fileUid}/mt/${mtUid}/locales/all/file/zip`
            })
        );

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
        mockSmartlingRequest();

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            undefined,
            "en-US",
            ["fr-FR"]
        );

        expect(detectFileType).toHaveBeenCalledWith(
            context,
            { fileName, content: fileBuffer }
        );

        expect(result.content).toEqual(Buffer.from("translated content"));
    });

    test("file type provided (skip detection)", async () => {
        mockSmartlingRequest();

        await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"]
        );

        expect(detectFileType).not.toHaveBeenCalled();
    });

    test("source locale provided (skip language detection)", async () => {
        mockSmartlingRequest();

        await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"]
        );

        // Should not call language detection endpoints
        const calls = smartlingRequest.mock.calls;
        const langDetectCalls = calls.filter((c: any) =>
            (c[1].path as string).includes("/language-detection")
        );
        expect(langDetectCalls).toHaveLength(0);
    });

    test("source locale auto-detection", async () => {
        mockSmartlingRequest({
            langDetectStatus: {
                state: "COMPLETED",
                detectedSourceLanguages: [{ defaultLocaleId: "de-DE" }]
            }
        });

        await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            undefined,
            ["fr-FR"]
        );

        // Verify translation used the detected locale
        expect(smartlingRequest).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                body: { sourceLocaleId: "de-DE", targetLocaleIds: ["fr-FR"] }
            })
        );
    });

    test("translation in progress returns metadata", async () => {
        mockSmartlingRequest({
            translateStatus: { state: "PROCESSING" }
        });

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"]
        );

        expect(result.content).toEqual(Buffer.alloc(0));
        expect(result.fileName).toBe("");
        expect(result.contentType).toBe("");
        expect(result.metadata).toEqual({
            fileUid,
            mtUid,
            targetLocales: ["fr-FR"],
            state: "PROCESSING",
            message: "Translation is still in progress. Use the fileUid and mtUid to check status or download later.",
            fullFileName: fileName,
            fileName: "test-file",
            fileExtension: ".txt"
        });
    });

    test("translation fails with FAILED state", async () => {
        mockSmartlingRequest({
            translateStatus: { state: "FAILED" }
        });

        await expect(
            executeFileMt(
                context,
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
        mockSmartlingRequest({
            translateStatus: { state: "CANCELED" }
        });

        await expect(
            executeFileMt(
                context,
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
        mockSmartlingRequest({
            langDetectStatus: {
                state: "FAILED",
                detectedSourceLanguages: []
            }
        });

        await expect(
            executeFileMt(
                context,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                undefined,
                ["fr-FR"]
            )
        ).rejects.toThrow("Language detection failed.");
    });

    test("language detection not completed immediately throws error", async () => {
        mockSmartlingRequest({
            langDetectStatus: {
                state: "QUEUED",
                detectedSourceLanguages: []
            }
        });

        await expect(
            executeFileMt(
                context,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                undefined,
                ["fr-FR"]
            )
        ).rejects.toThrow("Language detection did not complete immediately. Please specify source locale manually.");
    });

    test("error during upload propagates", async () => {
        smartlingRequest.mockImplementation((_ctx: any, opts: any) => {
            if (opts.path.endsWith("/files") && opts.method === "POST") {
                return Promise.reject(new Error("Upload failed"));
            }
            return Promise.resolve({});
        });

        await expect(
            executeFileMt(
                context,
                accountUid,
                fileBuffer,
                fileName,
                "html",
                "en-US",
                ["fr-FR"]
            )
        ).rejects.toThrow("Upload failed");
    });

    test("uses default fileName when content-disposition has no filename", async () => {
        mockSmartlingRequest({
            download: {
                body: Buffer.from("translated content"),
                headers: {
                    "content-type": "text/plain"
                }
            }
        });

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"]
        );

        expect(result.fileName).toBe("translation");
    });

    test("uses default contentType when response has no content-type", async () => {
        mockSmartlingRequest({
            download: {
                body: Buffer.from("translated content"),
                headers: {
                    "content-disposition": 'attachment; filename="test.txt"'
                }
            }
        });

        const result = await executeFileMt(
            context,
            accountUid,
            fileBuffer,
            fileName,
            "html",
            "en-US",
            ["fr-FR"]
        );

        expect(result.contentType).toBe("application/octet-stream");
    });
});
