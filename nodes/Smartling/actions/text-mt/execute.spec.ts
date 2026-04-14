import {
    MAX_TEXT_ITEMS_FOR_TRANSLATION,
    MAX_TEXT_LENGTH_FOR_TRANSLATION,
} from "../../common/constants";
import { executeTextMt } from "./execute";

const mockSmartlingRequest = jest.fn();
jest.mock("../../common/smartling-api", () => ({
    smartlingRequest: (...args: any[]) => mockSmartlingRequest(...args),
}));

describe("executeTextMt", () => {
    const mockContext = {};

    beforeEach(() => {
        mockSmartlingRequest.mockReset();
    });

    test("translates single text item", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [{ key: "key.1", translationText: "Hallo Welt" }],
        });

        const result = await executeTextMt(mockContext, "testAccountUid", "en-US", "de-DE", "Hello world");

        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            mockContext,
            expect.objectContaining({
                method: "POST",
                path: "/mt-router-api/v2/accounts/testAccountUid/smartling-mt",
                body: expect.objectContaining({
                    sourceLocaleId: "en-US",
                    targetLocaleId: "de-DE",
                    items: [{ key: "key.1", sourceText: "Hello world" }],
                }),
            })
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "de-DE",
            source: { string_1: "Hello world" },
            translated: { string_1: "Hallo Welt" },
        });
    });

    test("translates multiple text items (newline-separated)", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hola" },
                { key: "key.2", translationText: "Mundo" },
            ],
        });

        const result = await executeTextMt(mockContext, "testAccountUid", "en-US", "es-ES", "Hello\nWorld");

        expect(mockSmartlingRequest).toHaveBeenCalledWith(
            mockContext,
            expect.objectContaining({
                body: expect.objectContaining({
                    sourceLocaleId: "en-US",
                    targetLocaleId: "es-ES",
                    items: [
                        { key: "key.1", sourceText: "Hello" },
                        { key: "key.2", sourceText: "World" },
                    ],
                }),
            })
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "es-ES",
            source: { string_1: "Hello", string_2: "World" },
            translated: { string_1: "Hola", string_2: "Mundo" },
        });
    });

    test("detects source locale when not provided", async () => {
        mockSmartlingRequest
            .mockResolvedValueOnce({
                languages: [{ defaultLocaleId: "en-US" }],
            })
            .mockResolvedValueOnce({
                items: [{ key: "key.1", translationText: "Hallo Welt" }],
            });

        const result = await executeTextMt(mockContext, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(mockSmartlingRequest).toHaveBeenNthCalledWith(
            1,
            mockContext,
            expect.objectContaining({
                method: "POST",
                path: "/language-detection-api/v1/detect/language",
                body: { text: "Hello world" },
            })
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "de-DE",
            source: { string_1: "Hello world" },
            translated: { string_1: "Hallo Welt" },
        });
    });

    test("skips detection when source locale is provided", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [{ key: "key.1", translationText: "Hallo Welt" }],
        });

        await executeTextMt(mockContext, "testAccountUid", "en-US", "de-DE", "Hello world");

        expect(mockSmartlingRequest).toHaveBeenCalledTimes(1);
        expect(mockSmartlingRequest).not.toHaveBeenCalledWith(
            mockContext,
            expect.objectContaining({ path: "/language-detection-api/v1/detect/language" })
        );
    });

    test("throws error when text is too long", async () => {
        const tooLongText = "a".repeat(MAX_TEXT_LENGTH_FOR_TRANSLATION + 1);

        await expect(
            executeTextMt(mockContext, "testAccountUid", "en-US", "de-DE", tooLongText)
        ).rejects.toThrow(
            `Source text is too long. Maximum allowed length is ${MAX_TEXT_LENGTH_FOR_TRANSLATION}.`
        );
    });

    test("throws error when too many items are provided", async () => {
        const lines = new Array(MAX_TEXT_ITEMS_FOR_TRANSLATION + 1).fill("text").join("\n");

        await expect(
            executeTextMt(mockContext, "testAccountUid", "en-US", "de-DE", lines)
        ).rejects.toThrow(
            `Too many source text items. Maximum allowed number is ${MAX_TEXT_ITEMS_FOR_TRANSLATION}.`
        );
    });

    test("throws error when translation is empty", async () => {
        mockSmartlingRequest.mockResolvedValue({ items: [] });

        await expect(
            executeTextMt(mockContext, "testAccountUid", "en-US", "de-DE", "Hello world")
        ).rejects.toThrow("Translation is empty.");
    });

    test("trims and filters empty lines from input", async () => {
        mockSmartlingRequest.mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hola" },
                { key: "key.2", translationText: "Mundo" },
            ],
        });

        const result = await executeTextMt(
            mockContext,
            "testAccountUid",
            "en-US",
            "es-ES",
            "  Hello  \n\n  World  \n  "
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "es-ES",
            source: { string_1: "Hello", string_2: "World" },
            translated: { string_1: "Hola", string_2: "Mundo" },
        });
    });

    test("constructs locale from languageId and defaultCountryId when defaultLocaleId is missing", async () => {
        mockSmartlingRequest
            .mockResolvedValueOnce({
                languages: [{ languageId: "en", defaultCountryId: "US" }],
            })
            .mockResolvedValueOnce({
                items: [{ key: "key.1", translationText: "Hallo Welt" }],
            });

        const result = await executeTextMt(mockContext, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(result.sourceLocaleId).toEqual("en-US");
    });

    test("returns languageId when both defaultLocaleId and defaultCountryId are missing", async () => {
        mockSmartlingRequest
            .mockResolvedValueOnce({
                languages: [{ languageId: "en" }],
            })
            .mockResolvedValueOnce({
                items: [{ key: "key.1", translationText: "Hallo Welt" }],
            });

        const result = await executeTextMt(mockContext, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(result.sourceLocaleId).toEqual("en");
    });

    test("throws error when language detection returns no languages", async () => {
        mockSmartlingRequest.mockResolvedValue({ languages: [] });

        await expect(
            executeTextMt(mockContext, "testAccountUid", undefined, "de-DE", "Hello world")
        ).rejects.toThrow("Language detection didn't return any language.");
    });
});
