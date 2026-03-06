import {
    DownloadFileWithMetadataParameters,
    FileNameMode,
    RetrievalType,
    SmartlingFilesApi
} from "smartling-api-sdk-nodejs";
import { createContextMock } from "../../../../test/mocks";
import { Context } from "../../common/context";
import { executeDownloadTranslatedFile } from "./execute";

describe("executeDownloadTranslatedFile", () => {
    let contextMock: Context;
    let filesApiMock: ReturnType<Context["getFilesApi"]>;

    const createExpectedParameters = (options: {
        retrievalType?: RetrievalType;
        includeOriginalStrings?: boolean;
    } = {}) => {
        const params = new DownloadFileWithMetadataParameters();
        params.setFileNameMode(FileNameMode.TRANSFORMED);

        if (options.retrievalType) {
            params.setRetrievalType(options.retrievalType);
        }

        if (options.includeOriginalStrings === true) {
            params.includeOriginalStrings();
        } else if (options.includeOriginalStrings === false) {
            params.excludeOriginalStrings();
        }

        return params;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        contextMock = createContextMock();
        filesApiMock = contextMock.getFilesApi() as jest.Mocked<SmartlingFilesApi>;
    });

    test("downloads file with minimal parameters", async () => {
        const mockResponse = {
            fileContent: Buffer.from("translated file content"),
            fileName: "files/test-file.json",
            contentType: "application/json"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        const result = await executeDownloadTranslatedFile(
            contextMock,
            "test-project-123",
            "files/test-file.json",
            "es-ES"
        );

        const expectedParams = createExpectedParameters();
        expect(filesApiMock.downloadFileWithMetadata).toHaveBeenCalledWith(
            "test-project-123",
            "files/test-file.json",
            "es-ES",
            expectedParams
        );
        expect(result).toEqual({
            content: Buffer.from("translated file content"),
            fileName: "test-file.json",
            contentType: "application/json"
        });
    });

    test("downloads file with all parameters", async () => {
        const mockResponse = {
            fileContent: Buffer.from("translated file content"),
            fileName: "files/test-file.json",
            contentType: "application/json"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        const result = await executeDownloadTranslatedFile(
            contextMock,
            "test-project-123",
            "files/test-file.json",
            "es-ES",
            RetrievalType.PENDING,
            true
        );

        const expectedParams = createExpectedParameters({
            retrievalType: RetrievalType.PENDING,
            includeOriginalStrings: true
        });
        expect(filesApiMock.downloadFileWithMetadata).toHaveBeenCalledWith(
            "test-project-123",
            "files/test-file.json",
            "es-ES",
            expectedParams
        );
        expect(result).toEqual({
            content: Buffer.from("translated file content"),
            fileName: "test-file.json",
            contentType: "application/json"
        });
    });

    test("downloads file with published retrieval type", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: "file.xml",
            contentType: "application/xml"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "file.xml",
            "fr-FR",
            RetrievalType.PUBLISHED
        );

        const expectedParams = createExpectedParameters({
            retrievalType: RetrievalType.PUBLISHED
        });
        expect(filesApiMock.downloadFileWithMetadata).toHaveBeenCalledWith(
            "proj-1",
            "file.xml",
            "fr-FR",
            expectedParams
        );
    });

    test("downloads file with approved retrieval type", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: "file.xml",
            contentType: "application/xml"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "file.xml",
            "de-DE",
            "approved"
        );

        const expectedParams = createExpectedParameters({
            retrievalType: "approved" as RetrievalType
        });
        expect(filesApiMock.downloadFileWithMetadata).toHaveBeenCalledWith(
            "proj-1",
            "file.xml",
            "de-DE",
            expectedParams
        );
    });

    test("downloads file with includeOriginalStrings set to false", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: "file.json",
            contentType: "application/json"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "file.json",
            "ja-JP",
            undefined,
            false
        );

        const expectedParams = createExpectedParameters({
            includeOriginalStrings: false
        });
        expect(filesApiMock.downloadFileWithMetadata).toHaveBeenCalledWith(
            "proj-1",
            "file.json",
            "ja-JP",
            expectedParams
        );
    });

    test("extracts filename from complex file URI", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: "path/to/deeply/nested/my-document.xml",
            contentType: "application/xml"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        const result = await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "path/to/deeply/nested/my-document.xml",
            "es-ES"
        );

        expect(result.fileName).toBe("my-document.xml");
    });

    test("falls back to fileUri when fileName is not in response", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: undefined,
            contentType: "text/plain"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        const result = await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "simple-file.txt",
            "es-ES"
        );

        expect(result.fileName).toBe("simple-file.txt");
    });

    test("handles API error", async () => {
        const apiError = new Error("File not found");
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockRejectedValue(apiError);

        await expect(
            executeDownloadTranslatedFile(
                contextMock,
                "proj-1",
                "missing-file.json",
                "es-ES"
            )
        ).rejects.toThrow("File not found");
    });

    test("logs download start and completion", async () => {
        const mockResponse = {
            fileContent: Buffer.from("content"),
            fileName: "file.json",
            contentType: "application/json"
        };
        (filesApiMock.downloadFileWithMetadata as jest.Mock).mockResolvedValue(mockResponse);

        await executeDownloadTranslatedFile(
            contextMock,
            "proj-1",
            "file.json",
            "es-ES",
            RetrievalType.PENDING,
            true
        );

        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "Downloading translated file.",
            expect.objectContaining({
                projectUid: "proj-1",
                fileUri: "file.json",
                targetLocale: "es-ES",
                retrievalType: RetrievalType.PENDING,
                includeOriginalStrings: true
            })
        );
        expect(contextMock.logger.info).toHaveBeenCalledWith(
            "Download translated file completed successfully.",
            expect.objectContaining({
                projectUid: "proj-1",
                fileUri: "file.json",
                targetLocale: "es-ES"
            })
        );
    });
});
