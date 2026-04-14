export const extractResourceLocatorValue = (raw: unknown): string => {
    if (typeof raw === "object" && raw !== null && "__rl" in raw) {
        return (raw as unknown as { value: string }).value;
    }
    return raw as string;
};

export const isValidURL = (str: string): boolean => {
    try {
        const _ = new URL(str);
        return true;
    } catch {
        return false;
    }
};

export const toStringArray = (values: string | string[]): string[] => Array.isArray(values)
    ? values
    : values.split(",").map(value => value.trim());
