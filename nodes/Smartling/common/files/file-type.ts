import { smartlingRequest } from "../smartling-api";
import { FILE_TYPE_DETECTION_MAX_BUFFER_SIZE } from "../constants";
import { getFileTypeByExtension } from "./file-extensions";
import { FileType } from "./file-types";
import { parseFileName } from "../file-utils";

export interface FileContentForDetection {
    fileName: string;
    content: Buffer;
    contentType?: string;
}

export const detectFileType = async (
    context: any,
    fileContent: FileContentForDetection
): Promise<FileType> => {
    const parsed = parseFileName(fileContent.fileName);
    if (parsed.ext?.length) {
        const fileTypeByExtension = getFileTypeByExtension(parsed.ext);
        if (fileTypeByExtension) {
            return fileTypeByExtension;
        }
    }

    const boundary = "----n8nSmartlingBoundary" + Date.now().toString(36);
    const length = Math.min(FILE_TYPE_DETECTION_MAX_BUFFER_SIZE, fileContent.content.length);
    const fileBuffer = fileContent.content.subarray(0, length);

    const prefix = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileContent.fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([prefix, fileBuffer, suffix]);

    const response = await smartlingRequest(context, {
        method: "POST",
        path: "/filetype/v2/identify",
        body,
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
    });

    if (!response.type?.length) {
        throw new Error("File type detection response does not contain any file type.");
    }
    return response.type[0] as FileType;
};
