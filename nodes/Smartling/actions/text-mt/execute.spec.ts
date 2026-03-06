import { SmartlingMachineTranslationsApi } from "smartling-api-sdk-nodejs";
import { Context } from "../../common/context";
import { createContextMock } from "../../../../test/mocks";
import {
    MAX_TEXT_ITEMS_FOR_TRANSLATION,
    MAX_TEXT_LENGTH_FOR_TRANSLATION
} from "../../common/constants";
import { executeTextMt } from "./execute";

describe("executeTextMt", () => {
    let contextMock: Context;
    let mtApiMock: jest.Mocked<Pick<SmartlingMachineTranslationsApi, "translate">>;
    let languageDetectionApiMock: jest.Mocked<{ detectLanguage: jest.Mock }>;

    beforeEach(() => {
        contextMock = createContextMock();
        mtApiMock = contextMock.getMTApi() as any;
        languageDetectionApiMock = contextMock.getLanguageDetectionApi() as any;
    });

    test("translates single text item", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hallo Welt" }
            ]
        });

        const result = await executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", "Hello world");

        expect(mtApiMock.translate).toHaveBeenCalledWith(
            "testAccountUid",
            expect.objectContaining({
                parameters: {
                    sourceLocaleId: "en-US",
                    targetLocaleId: "de-DE",
                    items: [
                        { key: "key.1", sourceText: "Hello world" }
                    ]
                }
            })
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "de-DE",
            source: { string_1: "Hello world" },
            translated: { string_1: "Hallo Welt" }
        });
    });

    test("translates multiple text items (newline-separated)", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hola" },
                { key: "key.2", translationText: "Mundo" }
            ]
        });

        const result = await executeTextMt(contextMock, "testAccountUid", "en-US", "es-ES", "Hello\nWorld");

        expect(mtApiMock.translate).toHaveBeenCalledWith(
            "testAccountUid",
            expect.objectContaining({
                parameters: {
                    sourceLocaleId: "en-US",
                    targetLocaleId: "es-ES",
                    items: [
                        { key: "key.1", sourceText: "Hello" },
                        { key: "key.2", sourceText: "World" }
                    ]
                }
            })
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "es-ES",
            source: { string_1: "Hello", string_2: "World" },
            translated: { string_1: "Hola", string_2: "Mundo" }
        });
    });

    test("detects source locale when not provided", async () => {
        languageDetectionApiMock.detectLanguage.mockResolvedValue({
            languages: [{ defaultLocaleId: "en-US" }]
        });

        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hallo Welt" }
            ]
        });

        const result = await executeTextMt(contextMock, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(languageDetectionApiMock.detectLanguage).toHaveBeenCalledWith("Hello world");
        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "de-DE",
            source: { string_1: "Hello world" },
            translated: { string_1: "Hallo Welt" }
        });
    });

    test("skips detection when source locale is provided", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hallo Welt" }
            ]
        });

        await executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", "Hello world");

        expect(languageDetectionApiMock.detectLanguage).not.toHaveBeenCalled();
    });

    test("throws error when text is too long", async () => {
        const tooLongText = "a".repeat(MAX_TEXT_LENGTH_FOR_TRANSLATION + 1);

        await expect(
            executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", tooLongText)
        ).rejects.toThrow(
            `Source text is too long. Maximum allowed length is ${MAX_TEXT_LENGTH_FOR_TRANSLATION}.`
        );
    });

    test("throws error when too many items are provided", async () => {
        const lines = new Array(MAX_TEXT_ITEMS_FOR_TRANSLATION + 1).fill("text").join("\n");

        await expect(
            executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", lines)
        ).rejects.toThrow(
            `Too many source text items. Maximum allowed number is ${MAX_TEXT_ITEMS_FOR_TRANSLATION}.`
        );
    });

    test("calls logger info and flush", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hallo Welt" }
            ]
        });

        await executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", "Hello world");

        expect(contextMock.logger.info).toHaveBeenCalled();
    });

    test("throws error when translation is empty", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: []
        });

        await expect(
            executeTextMt(contextMock, "testAccountUid", "en-US", "de-DE", "Hello world")
        ).rejects.toThrow("Translation is empty.");
    });

    test("trims and filters empty lines from input", async () => {
        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [
                { key: "key.1", translationText: "Hola" },
                { key: "key.2", translationText: "Mundo" }
            ]
        });

        const result = await executeTextMt(
            contextMock,
            "testAccountUid",
            "en-US",
            "es-ES",
            "  Hello  \n\n  World  \n  "
        );

        expect(result).toEqual({
            sourceLocaleId: "en-US",
            targetLocaleId: "es-ES",
            source: { string_1: "Hello", string_2: "World" },
            translated: { string_1: "Hola", string_2: "Mundo" }
        });
    });

    test("constructs locale from languageId and defaultCountryId when defaultLocaleId is missing", async () => {
        languageDetectionApiMock.detectLanguage.mockResolvedValue({
            languages: [{ languageId: "en", defaultCountryId: "US" }]
        });

        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [{ key: "key.1", translationText: "Hallo Welt" }]
        });

        const result = await executeTextMt(contextMock, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(result.sourceLocaleId).toEqual("en-US");
    });

    test("returns languageId when both defaultLocaleId and defaultCountryId are missing", async () => {
        languageDetectionApiMock.detectLanguage.mockResolvedValue({
            languages: [{ languageId: "en" }]
        });

        mtApiMock.translate = jest.fn().mockResolvedValue({
            items: [{ key: "key.1", translationText: "Hallo Welt" }]
        });

        const result = await executeTextMt(contextMock, "testAccountUid", undefined, "de-DE", "Hello world");

        expect(result.sourceLocaleId).toEqual("en");
    });

    test("throws error when language detection returns no languages", async () => {
        languageDetectionApiMock.detectLanguage.mockResolvedValue({
            languages: []
        });

        await expect(
            executeTextMt(contextMock, "testAccountUid", undefined, "de-DE", "Hello world")
        ).rejects.toThrow("Language detection didn't return any language.");
    });
});
