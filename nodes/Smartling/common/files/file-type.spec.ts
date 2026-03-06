import { IdentifyFileTypeParameters } from "@smartling/api-sdk-nodejs-internal";
import { FILE_TYPE_DETECTION_MAX_BUFFER_SIZE } from "../constants";
import { getFileTypeByExtension } from "./file-extensions";
import { FileType } from "./file-types";
import { detectFileType } from "./file-type";

jest.mock("./file-extensions", () => ({
    getFileTypeByExtension: jest.fn()
}));

const createLoggerMock = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getRequestId: jest.fn().mockReturnValue("test-request-id"),
    flush: jest.fn().mockResolvedValue(undefined)
});

const createFileTypeApiMock = () => ({
    indentifyFileType: jest.fn()
});

describe("detectFileType()", () => {
    const loggerMock = createLoggerMock();
    const fileTypeApiMock = createFileTypeApiMock();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("detects file type by extension when extension is recognized", async () => {
        const fileContent = {
            fileName: "test.html",
            content: Buffer.from("<html></html>"),
            contentType: "text/html"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(FileType.HTML);

        const result = await detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".html");
        expect(result).toBe(FileType.HTML);
        expect(fileTypeApiMock.indentifyFileType).not.toHaveBeenCalled();
        expect(loggerMock.info).toHaveBeenCalledWith(
            "File type detected by extension.",
            {
                fileExtension: ".html",
                fileType: FileType.HTML
            }
        );
    });

    test("detects file type via API when extension is not recognized", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        fileTypeApiMock.indentifyFileType = jest.fn().mockResolvedValue({
            type: [FileType.PLAIN_TEXT]
        });

        const result = await detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".unknown");
        expect(fileTypeApiMock.indentifyFileType).toHaveBeenCalledWith(
            expect.any(IdentifyFileTypeParameters)
        );
        expect(result).toBe(FileType.PLAIN_TEXT);
        expect(loggerMock.info).toHaveBeenCalledWith(
            "File type detected via API.",
            {
                fileName: "test.unknown",
                fileType: FileType.PLAIN_TEXT,
                response: JSON.stringify({ type: [FileType.PLAIN_TEXT] })
            }
        );
    });

    test("detects file type via API and gets first type when API returns a few types", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        fileTypeApiMock.indentifyFileType = jest.fn().mockResolvedValue({
            type: [FileType.PLAIN_TEXT, FileType.HTML, FileType.JSON]
        });

        const result = await detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".unknown");
        expect(fileTypeApiMock.indentifyFileType).toHaveBeenCalledWith(
            expect.any(IdentifyFileTypeParameters)
        );
        expect(result).toBe(FileType.PLAIN_TEXT);
        expect(loggerMock.info).toHaveBeenCalledWith(
            "File type detected via API.",
            {
                fileName: "test.unknown",
                fileType: FileType.PLAIN_TEXT,
                response: JSON.stringify({ type: [FileType.PLAIN_TEXT, FileType.HTML, FileType.JSON] })
            }
        );
    });

    test("detects file type via API when file has no extension", async () => {
        const fileContent = {
            fileName: "test",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        fileTypeApiMock.indentifyFileType = jest.fn().mockResolvedValue({
            type: [FileType.PLAIN_TEXT]
        });

        const result = await detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any);

        expect(getFileTypeByExtension).not.toHaveBeenCalled();
        expect(fileTypeApiMock.indentifyFileType).toHaveBeenCalledWith(
            expect.any(IdentifyFileTypeParameters)
        );
        expect(result).toBe(FileType.PLAIN_TEXT);
    });

    test("uses limited buffer size for file type detection when content is large", async () => {
        const largeContent = Buffer.alloc(FILE_TYPE_DETECTION_MAX_BUFFER_SIZE + 1000, "x");
        const fileContent = {
            fileName: "test.bin",
            content: largeContent,
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        fileTypeApiMock.indentifyFileType = jest.fn().mockImplementation((params) => {
            expect(params.export().file).toHaveLength(FILE_TYPE_DETECTION_MAX_BUFFER_SIZE);
            return Promise.resolve({ type: [FileType.PLAIN_TEXT] });
        });

        await detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any);

        expect(fileTypeApiMock.indentifyFileType).toHaveBeenCalled();
    });

    test("throws an error when API response doesn't contain file type", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        fileTypeApiMock.indentifyFileType = jest.fn().mockResolvedValue({
            type: []
        });

        await expect(
            detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any)
        ).rejects.toThrow("File type detection response does not contain any file type.");

        expect(loggerMock.error).toHaveBeenCalledWith(
            "File type detection response does not contain any file type.",
            {
                fileName: "test.unknown",
                contentType: "application/octet-stream",
                response: JSON.stringify({ type: [] })
            }
        );
    });

    test("propagates API errors", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        const apiError = new Error("API failure");
        fileTypeApiMock.indentifyFileType = jest.fn().mockRejectedValue(apiError);

        await expect(
            detectFileType(loggerMock as any, fileContent, fileTypeApiMock as any)
        ).rejects.toThrow(apiError);
    });
});
