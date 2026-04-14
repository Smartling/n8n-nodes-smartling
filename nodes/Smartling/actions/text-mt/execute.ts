import { smartlingRequest } from "../../common/smartling-api";
import {
    MAX_TEXT_ITEMS_FOR_TRANSLATION,
    MAX_TEXT_LENGTH_FOR_TRANSLATION,
} from "../../common/constants";

const TRANSLATION_KEY_PREFIX = "key";
const TRANSLATION_KEY_SEPARATOR = ".";
const RESPONSE_KEY_PREFIX = "string_";

const detectSourceLocale = async (context: any, content: string): Promise<string> => {
    const result = await smartlingRequest(context, {
        method: "POST",
        path: "/language-detection-api/v1/detect/language",
        body: { text: content },
    });

    if (!result.languages?.length) {
        throw new Error("Language detection didn't return any language.");
    }

    const lang = result.languages[0];
    if (lang.defaultLocaleId) return lang.defaultLocaleId;
    return lang.defaultCountryId
        ? `${lang.languageId}-${lang.defaultCountryId}`
        : lang.languageId;
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
    context: any,
    accountUid: string,
    sourceLocale: string | undefined,
    targetLocale: string,
    sourceText: string
): Promise<Record<string, unknown>> => {
    const sourceTextItems = prepareAndValidateInputText(sourceText);

    const sourceLocaleId = sourceLocale || await detectSourceLocale(context, sourceTextItems[0]);
    const targetLocaleId = targetLocale;

    const items = sourceTextItems.map((text, index) => ({
        key: `${TRANSLATION_KEY_PREFIX}${TRANSLATION_KEY_SEPARATOR}${index + 1}`,
        sourceText: text,
    }));

    const translation = await smartlingRequest(context, {
        method: "POST",
        path: `/mt-router-api/v2/accounts/${accountUid}/smartling-mt`,
        body: { sourceLocaleId, targetLocaleId, items },
    });

    if (!translation.items?.length) {
        throw new Error("Translation is empty.");
    }

    translation.items.sort((left: { key: string }, right: { key: string }) => {
        const lengthDiff = left.key.length - right.key.length;
        return lengthDiff !== 0 ? lengthDiff : left.key.localeCompare(right.key);
    });

    const source = sourceTextItems.reduce<Record<string, string>>((acc, item, index) => {
        acc[`${RESPONSE_KEY_PREFIX}${index + 1}`] = item;
        return acc;
    }, {});

    const translatedItems: Array<{ key: string; translationText: string }> = translation.items;
    const translated = translatedItems.reduce<Record<string, string>>(
        (acc, item) => {
            const index = item.key.split(TRANSLATION_KEY_SEPARATOR)[1];
            acc[`${RESPONSE_KEY_PREFIX}${index}`] = item.translationText;
            return acc;
        },
        {}
    );

    return { sourceLocaleId, targetLocaleId, source, translated };
};
