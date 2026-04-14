import { executeDownloadTranslatedFile } from "./execute";

const mockSmartlingRequest = jest.fn();
jest.mock("../../common/smartling-api", () => ({
    smartlingRequest: (...args: any[]) => mockSmartlingRequest(...args),
}));

describe("executeDownloadTranslatedFile", () => {
    const mockContext = {};

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("downloads file with minimal parameters", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("translated file content"),
            headers: {
                "content-disposition": 'attachment; filename="test-file.json"',
                "content-type": "application/json",
            },
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "test-project-123",
            "files/test-file.json",
            "es-ES",
            undefined,
            false
        );

        expect(mockSmartlingRequest).toHaveBeenCalledWith(mockContext, {
            method: "GET",
            path: "/files-api/v2/projects/test-project-123/locales/es-ES/file",
            qs: {
                fileUri: "files/test-file.json",
            },
            encoding: "arraybuffer",
            returnFullResponse: true,
        });
        expect(result).toEqual({
            content: Buffer.from("translated file content"),
            fileName: "test-file.json",
            contentType: "application/json",
        });
    });

    test("downloads file with all parameters", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("translated file content"),
            headers: {
                "content-disposition": 'attachment; filename="test-file.json"',
                "content-type": "application/json",
            },
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "test-project-123",
            "files/test-file.json",
            "es-ES",
            "PENDING",
            true
        );

        expect(mockSmartlingRequest).toHaveBeenCalledWith(mockContext, {
            method: "GET",
            path: "/files-api/v2/projects/test-project-123/locales/es-ES/file",
            qs: {
                fileUri: "files/test-file.json",
                retrievalType: "PENDING",
                includeOriginalStrings: "true",
            },
            encoding: "arraybuffer",
            returnFullResponse: true,
        });
        expect(result).toEqual({
            content: Buffer.from("translated file content"),
            fileName: "test-file.json",
            contentType: "application/json",
        });
    });

    test("downloads file with published retrieval type", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-disposition": 'attachment; filename="file.xml"',
                "content-type": "application/xml",
            },
            statusCode: 200,
        });

        await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "file.xml",
            "fr-FR",
            "PUBLISHED",
            false
        );

        expect(mockSmartlingRequest).toHaveBeenCalledWith(mockContext, expect.objectContaining({
            qs: expect.objectContaining({
                retrievalType: "PUBLISHED",
            }),
        }));
    });

    test("downloads file with approved retrieval type", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-disposition": 'attachment; filename="file.xml"',
                "content-type": "application/xml",
            },
            statusCode: 200,
        });

        await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "file.xml",
            "de-DE",
            "approved",
            false
        );

        expect(mockSmartlingRequest).toHaveBeenCalledWith(mockContext, expect.objectContaining({
            qs: expect.objectContaining({
                retrievalType: "approved",
            }),
        }));
    });

    test("downloads file with includeOriginalStrings set to false", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-disposition": 'attachment; filename="file.json"',
                "content-type": "application/json",
            },
            statusCode: 200,
        });

        await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "file.json",
            "ja-JP",
            undefined,
            false
        );

        // includeOriginalStrings is false, so it should NOT be in qs
        expect(mockSmartlingRequest).toHaveBeenCalledWith(mockContext, expect.objectContaining({
            qs: expect.not.objectContaining({
                includeOriginalStrings: expect.anything(),
            }),
        }));
    });

    test("extracts filename from complex file URI via content-disposition", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-disposition": 'attachment; filename="my-document.xml"',
                "content-type": "application/xml",
            },
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "path/to/deeply/nested/my-document.xml",
            "es-ES",
            undefined,
            false
        );

        expect(result.fileName).toBe("my-document.xml");
    });

    test("falls back to fileUri when content-disposition header is absent", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-type": "text/plain",
            },
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "simple-file.txt",
            "es-ES",
            undefined,
            false
        );

        expect(result.fileName).toBe("simple-file.txt");
    });

    test("falls back to fileUri basename when content-disposition has no filename", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {
                "content-disposition": "attachment",
                "content-type": "text/plain",
            },
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "path/to/simple-file.txt",
            "es-ES",
            undefined,
            false
        );

        expect(result.fileName).toBe("simple-file.txt");
    });

    test("handles API error", async () => {
        const apiError = new Error("File not found");
        mockSmartlingRequest.mockRejectedValue(apiError);

        await expect(
            executeDownloadTranslatedFile(
                mockContext,
                "proj-1",
                "missing-file.json",
                "es-ES",
                undefined,
                false
            )
        ).rejects.toThrow("File not found");
    });

    test("uses application/octet-stream as default content-type when header is missing", async () => {
        mockSmartlingRequest.mockResolvedValue({
            body: Buffer.from("content"),
            headers: {},
            statusCode: 200,
        });

        const result = await executeDownloadTranslatedFile(
            mockContext,
            "proj-1",
            "file.bin",
            "es-ES",
            undefined,
            false
        );

        expect(result.contentType).toBe("application/octet-stream");
    });
});
