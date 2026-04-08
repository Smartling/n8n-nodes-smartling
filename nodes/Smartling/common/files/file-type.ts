import path from "path";
import { IdentifyFileTypeParameters, SmartlingFileTypesApi } from "../api/file-types-api";
import { RemoteLogger } from "../logger";
import { FILE_TYPE_DETECTION_MAX_BUFFER_SIZE } from "../constants";
import { getFileTypeByExtension } from "./file-extensions";
import { FileType } from "./file-types";

export interface FileContentForDetection {
    fileName: string;
    content: Buffer;
    contentType?: string;
}

export const detectFileType = async (
    logger: RemoteLogger,
    fileContent: FileContentForDetection,
    fileTypeApi: SmartlingFileTypesApi
): Promise<FileType> => {
    const parsedFileName = path.parse(fileContent.fileName);
    if (parsedFileName.ext?.length) {
        logger.debug(
            "Trying to detect file type by extension.",
            { fileExtension: parsedFileName.ext }
        );
        const fileTypeByExtension = getFileTypeByExtension(parsedFileName.ext);
        if (fileTypeByExtension) {
            logger.info(
                "File type detected by extension.",
                {
                    fileExtension: parsedFileName.ext,
                    fileType: fileTypeByExtension
                }
            );
            return fileTypeByExtension;
        }
    }

    logger.debug(
        "Detecting file type via API",
        { fileName: fileContent.fileName }
    );
    const length = Math.min(FILE_TYPE_DETECTION_MAX_BUFFER_SIZE, fileContent.content.length);
    const fileTypeIdentityParameters = new IdentifyFileTypeParameters()
        .setFileName(fileContent.fileName)
        .setFileContentFromBuffer(fileContent.content.subarray(0, length));

    const response = await fileTypeApi.indentifyFileType(fileTypeIdentityParameters);
    if (!response.type?.length) {
        logger.error(
            "File type detection response does not contain any file type.",
            {
                fileName: fileContent.fileName,
                contentType: fileContent.contentType,
                response: JSON.stringify(response)
            }
        );
        throw new Error("File type detection response does not contain any file type.");
    }
    const fileType = response.type[0] as FileType;
    logger.info(
        "File type detected via API.",
        {
            fileName: fileContent.fileName,
            fileType,
            response: JSON.stringify(response)
        }
    );
    return fileType;
};
