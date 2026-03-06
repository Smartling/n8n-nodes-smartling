import { SmartlingMTParameters } from "smartling-api-sdk-nodejs";
import { Context } from "../../common/context";
import {
    MAX_TEXT_ITEMS_FOR_TRANSLATION,
    MAX_TEXT_LENGTH_FOR_TRANSLATION
} from "../../common/constants";

const TRANSLATION_KEY_PREFIX = "key";
const TRANSLATION_KEY_SEPARATOR = ".";
const RESPONSE_KEY_PREFIX = "string_";

const getLocaleIdFromResponse = (response: {
    defaultLocaleId?: string;
    languageId: string;
    defaultCountryId?: string;
}): string => {
    if (response.defaultLocaleId) {
        return response.defaultLocaleId;
    }
    return response.defaultCountryId
        ? `${response.languageId}-${response.defaultCountryId}`
        : response.languageId;
};

const detectSourceLocale = async (ctx: Context, content: string): Promise<string> => {
    ctx.logger.debug("Starting language detection.", { content });

    const result = await ctx.getLanguageDetectionApi().detectLanguage(content);

    if (!result.languages.length) {
        throw new Error("Language detection didn't return any language.");
    }

    const localeId = getLocaleIdFromResponse(result.languages[0]);

    ctx.logger.info("Source locale successfully detected.", {
        content,
        localeId,
        response: JSON.stringify(result)
    });

    return localeId;
};

const prepareAndValidateInputText = (value: string): string[] => {
    const items = value
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (items.length > MAX_TEXT_ITEMS_FOR_TRANSLATION) {
        throw new Error(
            `Too many source text items. Maximum allowed number is ${MAX_TEXT_ITEMS_FOR_TRANSLATION}.`
        );
    }

    for (const item of items) {
        if (item.length > MAX_TEXT_LENGTH_FOR_TRANSLATION) {
            throw new Error(
                `Source text is too long. Maximum allowed length is ${MAX_TEXT_LENGTH_FOR_TRANSLATION}.`
            );
        }
    }

    return items;
};

export const executeTextMt = async (
    ctx: Context,
    accountUid: string,
    sourceLocale: string | undefined,
    targetLocale: string,
    sourceText: string
): Promise<Record<string, unknown>> => {
    ctx.logger.info("Text MT translation started.", { sourceLocale, targetLocale, sourceText });

    const sourceTextItems = prepareAndValidateInputText(sourceText);

    const sourceLocaleId = sourceLocale || await detectSourceLocale(ctx, sourceTextItems[0]);
    const targetLocaleId = targetLocale;

    const params = new SmartlingMTParameters(
        sourceLocaleId,
        targetLocaleId,
        sourceTextItems.map((text, index) => ({
            key: `${TRANSLATION_KEY_PREFIX}${TRANSLATION_KEY_SEPARATOR}${index + 1}`,
            sourceText: text
        }))
    );

    const translation = await ctx.getMTApi().translate(accountUid, params);

    if (!translation.items.length) {
        throw new Error("Translation is empty.");
    }

    ctx.logger.info("Text translation successfully complete.", {
        sourceLocaleId,
        targetLocaleId,
        source: sourceText,
        translation: JSON.stringify(translation.items)
    });

    translation.items.sort((left: { key: string }, right: { key: string }) => {
        const lengthDiff = left.key.length - right.key.length;
        return lengthDiff !== 0 ? lengthDiff : left.key.localeCompare(right.key);
    });

    const source = sourceTextItems.reduce<Record<string, string>>((acc, item, index) => {
        acc[`${RESPONSE_KEY_PREFIX}${index + 1}`] = item;
        return acc;
    }, {});

    const translated = translation.items.reduce<Record<string, string>>(
        (acc: Record<string, string>, item: { key: string; translationText: string }) => {
            const index = item.key.split(TRANSLATION_KEY_SEPARATOR)[1];
            acc[`${RESPONSE_KEY_PREFIX}${index}`] = item.translationText;
            return acc;
        },
        {}
    );

    return {
        sourceLocaleId,
        targetLocaleId,
        source,
        translated
    };
};
