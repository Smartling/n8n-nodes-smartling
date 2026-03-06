import { DEFAULT_FILE_CONTENT_TYPE, URL_DETECTION_LIMIT_CHARACTERS } from "../constants";
import { isValidURL } from "../utils";

const CONTENT_TYPE_HEADER = "content-type";
const CONTENT_DISPOSITION_HEADER = "content-disposition";
const UNKNOWN_FILE_NAME = "unknown";

const isValidFileName = (str: string | undefined | null): boolean => !!str && str.trim().length > 0;

const resolveFileName = (str: string | undefined | null): string => (str && isValidFileName(str)) ? str : UNKNOWN_FILE_NAME;

export interface FileContent {
    content: Buffer;
    fileName: string;
    contentType: string;
}

export const getFileContent = async (
    input: string | Buffer,
    httpRequest?: (url: string) => Promise<{ body: Buffer; headers: Record<string, string> }>
): Promise<Buffer> => {
    if (Buffer.isBuffer(input)) {
        return input;
    }

    if (input.length < URL_DETECTION_LIMIT_CHARACTERS && isValidURL(input)) {
        if (!httpRequest) {
            throw new Error("httpRequest callback is required to fetch content from a URL.");
        }
        const response = await httpRequest(input);
        return response.body;
    }

    return Buffer.from(input);
};

export const retrieveFileContent = async (
    fileName: string | undefined,
    fileBody: string,
    httpRequest?: (url: string) => Promise<{ body: Buffer; headers: Record<string, string> }>
): Promise<FileContent> => {
    if (fileBody.length < URL_DETECTION_LIMIT_CHARACTERS && isValidURL(fileBody)) {
        if (!httpRequest) {
            throw new Error("httpRequest callback is required to fetch content from a URL.");
        }
        const response = await httpRequest(fileBody);

        const contentType = response.headers[CONTENT_TYPE_HEADER] ?? DEFAULT_FILE_CONTENT_TYPE;
        let finalFileName = fileName;
        if (!isValidFileName(finalFileName)) {
            const contentDisposition = response.headers[CONTENT_DISPOSITION_HEADER];
            if (contentDisposition) {
                const fileNameMatch = /filename="((?:[^"\\]|\\.)*)"/.exec(contentDisposition);
                if (fileNameMatch) {
                    finalFileName = fileNameMatch[1].replace(/\\"/g, '"');
                }
            }
        }

        return {
            content: response.body,
            fileName: resolveFileName(finalFileName),
            contentType
        };
    }

    return {
        content: Buffer.from(fileBody),
        fileName: resolveFileName(fileName),
        contentType: DEFAULT_FILE_CONTENT_TYPE
    };
};
