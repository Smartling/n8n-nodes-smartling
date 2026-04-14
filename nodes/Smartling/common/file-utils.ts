export interface ParsedFileName {
    name: string;
    ext: string;
    base: string;
}

export function parseFileName(fileName: string): ParsedFileName {
    const lastSlash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
    const base = lastSlash >= 0 ? fileName.substring(lastSlash + 1) : fileName;
    const lastDot = base.lastIndexOf(".");
    if (lastDot <= 0) {
        return { name: base, ext: "", base };
    }
    return {
        name: base.substring(0, lastDot),
        ext: base.substring(lastDot),
        base,
    };
}
