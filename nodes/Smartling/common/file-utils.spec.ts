import { parseFileName } from "./file-utils";

describe("parseFileName", () => {
    it("should parse filename with extension", () => {
        expect(parseFileName("document.json")).toEqual({
            name: "document", ext: ".json", base: "document.json"
        });
    });

    it("should parse filename with path", () => {
        expect(parseFileName("/path/to/document.json")).toEqual({
            name: "document", ext: ".json", base: "document.json"
        });
    });

    it("should handle filename without extension", () => {
        expect(parseFileName("README")).toEqual({
            name: "README", ext: "", base: "README"
        });
    });

    it("should handle dotfile", () => {
        expect(parseFileName(".gitignore")).toEqual({
            name: ".gitignore", ext: "", base: ".gitignore"
        });
    });

    it("should handle multiple dots", () => {
        expect(parseFileName("archive.tar.gz")).toEqual({
            name: "archive.tar", ext: ".gz", base: "archive.tar.gz"
        });
    });
});
