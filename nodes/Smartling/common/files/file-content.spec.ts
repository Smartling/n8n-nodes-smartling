import { isValidURL } from "../utils";
import { DEFAULT_FILE_CONTENT_TYPE, URL_DETECTION_LIMIT_CHARACTERS } from "../constants";
import { getFileContent, retrieveFileContent } from "./file-content";

jest.mock("../utils", () => ({
    ...jest.requireActual("../utils"),
    isValidURL: jest.fn()
}));

describe("getFileContent()", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns Buffer directly when input is a Buffer", async () => {
        const input = Buffer.from("hello");
        const result = await getFileContent(input);
        expect(result).toBe(input);
    });

    test("fetches content from URL when input is a valid URL string", async () => {
        const url = "https://example.com/file.txt";
        const body = Buffer.from("remote content");
        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockResolvedValue({ body, headers: {} });

        const result = await getFileContent(url, httpRequest);

        expect(httpRequest).toHaveBeenCalledWith(url);
        expect(result).toEqual(body);
    });

    test("throws when input is a URL but no httpRequest callback provided", async () => {
        const url = "https://example.com/file.txt";
        (isValidURL as jest.Mock).mockReturnValue(true);

        await expect(getFileContent(url)).rejects.toThrow(
            "httpRequest callback is required to fetch content from a URL."
        );
    });

    test("converts string to Buffer when input is not a URL", async () => {
        const input = "<html><body>Test</body></html>";
        (isValidURL as jest.Mock).mockReturnValue(false);

        const result = await getFileContent(input);

        expect(result).toEqual(Buffer.from(input));
    });

    test("does not treat long strings as URLs", async () => {
        const longUrl = `https://example.com/${"a".repeat(URL_DETECTION_LIMIT_CHARACTERS)}`;

        const result = await getFileContent(longUrl);

        expect(isValidURL).not.toHaveBeenCalled();
        expect(result).toEqual(Buffer.from(longUrl));
    });
});

describe("retrieveFileContent()", () => {
    const fileName = "test-file.html";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns file content directly when input is not a URL", async () => {
        const fileBody = "<html><body>Test content</body></html>";
        (isValidURL as jest.Mock).mockReturnValue(false);

        const result = await retrieveFileContent(fileName, fileBody);

        expect(result).toEqual({
            content: Buffer.from(fileBody),
            fileName,
            contentType: DEFAULT_FILE_CONTENT_TYPE
        });
    });

    test("returns file content directly with default file name when input is not a URL and fileName is not provided", async () => {
        const fileBody = "<html><body>Test content</body></html>";
        (isValidURL as jest.Mock).mockReturnValue(false);

        const result = await retrieveFileContent("", fileBody);

        expect(result).toEqual({
            content: Buffer.from(fileBody),
            fileName: "unknown",
            contentType: DEFAULT_FILE_CONTENT_TYPE
        });
    });

    test("fetches content from URL when input is a valid URL", async () => {
        const fileUrl = "https://example.com/file.html";
        const fileContent = "<html><body>Remote content</body></html>";
        const contentType = "text/html; charset=utf-8";

        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockResolvedValue({
            body: Buffer.from(fileContent),
            headers: {
                "content-type": contentType
            }
        });

        const result = await retrieveFileContent(fileName, fileUrl, httpRequest);

        expect(httpRequest).toHaveBeenCalledWith(fileUrl);
        expect(result).toEqual({
            content: Buffer.from(fileContent),
            fileName,
            contentType
        });
    });

    test("uses default content type when Content-Type header is missing", async () => {
        const fileUrl = "https://example.com/file.txt";
        const fileContent = "Plain text content";

        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockResolvedValue({
            body: Buffer.from(fileContent),
            headers: {}
        });

        const result = await retrieveFileContent(fileName, fileUrl, httpRequest);

        expect(result).toEqual({
            content: Buffer.from(fileContent),
            fileName,
            contentType: DEFAULT_FILE_CONTENT_TYPE
        });
    });

    test("does not treat long URLs as URLs", async () => {
        const longUrl = `https://example.com/${"a".repeat(URL_DETECTION_LIMIT_CHARACTERS)}`;

        const result = await retrieveFileContent(fileName, longUrl);

        expect(isValidURL).not.toHaveBeenCalled();
        expect(result).toEqual({
            content: Buffer.from(longUrl),
            fileName,
            contentType: DEFAULT_FILE_CONTENT_TYPE
        });
    });

    test("handles request errors gracefully", async () => {
        const fileUrl = "https://example.com/broken-link";
        const error = new Error("Failed to fetch URL");

        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockRejectedValue(error);

        await expect(retrieveFileContent(fileName, fileUrl, httpRequest)).rejects.toThrow(error);
        expect(httpRequest).toHaveBeenCalledWith(fileUrl);
    });

    test("throws when input is a URL but no httpRequest callback provided", async () => {
        const fileUrl = "https://example.com/file.html";
        (isValidURL as jest.Mock).mockReturnValue(true);

        await expect(retrieveFileContent(fileName, fileUrl)).rejects.toThrow(
            "httpRequest callback is required to fetch content from a URL."
        );
    });

    test("extracts filename from Content-Disposition header when fileName is not provided", async () => {
        const fileUrl = "https://example.com/download";
        const fileContent = "Downloaded content";
        const contentDisposition = "attachment; filename=\"downloaded-file.pdf\"";

        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockResolvedValue({
            body: Buffer.from(fileContent),
            headers: {
                "content-type": "application/pdf",
                "content-disposition": contentDisposition
            }
        });

        const result = await retrieveFileContent("", fileUrl, httpRequest);

        expect(result).toEqual({
            content: Buffer.from(fileContent),
            fileName: "downloaded-file.pdf",
            contentType: "application/pdf"
        });
    });

    test("uses default filename when neither fileName nor Content-Disposition is available", async () => {
        const fileUrl = "https://example.com/unknown-file";
        const fileContent = "Mystery content";

        (isValidURL as jest.Mock).mockReturnValue(true);

        const httpRequest = jest.fn().mockResolvedValue({
            body: Buffer.from(fileContent),
            headers: {}
        });

        const result = await retrieveFileContent("", fileUrl, httpRequest);

        expect(result).toEqual({
            content: Buffer.from(fileContent),
            fileName: "unknown",
            contentType: DEFAULT_FILE_CONTENT_TYPE
        });
    });
});
