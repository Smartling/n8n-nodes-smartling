import { FILE_TYPE_DETECTION_MAX_BUFFER_SIZE } from "../constants";
import { getFileTypeByExtension } from "./file-extensions";
import { FileType } from "./file-types";
import { detectFileType } from "./file-type";
import { smartlingRequest } from "../smartling-api";

jest.mock("./file-extensions", () => ({
    getFileTypeByExtension: jest.fn()
}));

jest.mock("../smartling-api", () => ({
    smartlingRequest: jest.fn(),
}));

const mockContext = {};

describe("detectFileType()", () => {
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

        const result = await detectFileType(mockContext, fileContent);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".html");
        expect(result).toBe(FileType.HTML);
        expect(smartlingRequest).not.toHaveBeenCalled();
    });

    test("detects file type via API when extension is not recognized", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);
        (smartlingRequest as jest.Mock).mockResolvedValue({ type: [FileType.PLAIN_TEXT] });

        const result = await detectFileType(mockContext, fileContent);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".unknown");
        expect(smartlingRequest).toHaveBeenCalledWith(
            mockContext,
            expect.objectContaining({
                method: "POST",
                path: "/filetype/v2/identify",
            })
        );
        expect(result).toBe(FileType.PLAIN_TEXT);
    });

    test("detects file type via API and gets first type when API returns a few types", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);
        (smartlingRequest as jest.Mock).mockResolvedValue({
            type: [FileType.PLAIN_TEXT, FileType.HTML, FileType.JSON]
        });

        const result = await detectFileType(mockContext, fileContent);

        expect(getFileTypeByExtension).toHaveBeenCalledWith(".unknown");
        expect(result).toBe(FileType.PLAIN_TEXT);
    });

    test("detects file type via API when file has no extension", async () => {
        const fileContent = {
            fileName: "test",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (smartlingRequest as jest.Mock).mockResolvedValue({ type: [FileType.PLAIN_TEXT] });

        const result = await detectFileType(mockContext, fileContent);

        expect(getFileTypeByExtension).not.toHaveBeenCalled();
        expect(smartlingRequest).toHaveBeenCalled();
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
        (smartlingRequest as jest.Mock).mockImplementation((_ctx, opts) => {
            // The body is a Buffer built from prefix + truncated file + suffix.
            // Verify the body does not exceed expected max size by checking it's smaller than full content.
            const body: Buffer = opts.body;
            expect(body.length).toBeLessThan(largeContent.length);
            return Promise.resolve({ type: [FileType.PLAIN_TEXT] });
        });

        await detectFileType(mockContext, fileContent);

        expect(smartlingRequest).toHaveBeenCalled();
    });

    test("throws an error when API response doesn't contain file type", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);
        (smartlingRequest as jest.Mock).mockResolvedValue({ type: [] });

        await expect(
            detectFileType(mockContext, fileContent)
        ).rejects.toThrow("File type detection response does not contain any file type.");
    });

    test("propagates API errors", async () => {
        const fileContent = {
            fileName: "test.unknown",
            content: Buffer.from("test content"),
            contentType: "application/octet-stream"
        };

        (getFileTypeByExtension as jest.Mock).mockReturnValue(null);

        const apiError = new Error("API failure");
        (smartlingRequest as jest.Mock).mockRejectedValue(apiError);

        await expect(
            detectFileType(mockContext, fileContent)
        ).rejects.toThrow(apiError);
    });
});
