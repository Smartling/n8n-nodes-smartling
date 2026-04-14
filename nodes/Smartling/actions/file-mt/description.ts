import type { INodeProperties } from "n8n-workflow";
import { FileType, fileDescriptionMap } from "../../common/files";

const mtFileTypes = [
    FileType.ANDROID,
    FileType.HTML,
    FileType.XML,
    FileType.JSON,
    FileType.DOCX,
    FileType.PPTX,
    FileType.XLSX,
    FileType.IDML,
    FileType.RESX,
    FileType.PLAIN_TEXT,
    FileType.CSV,
    FileType.SRT,
    FileType.PRES,
    FileType.MARKDOWN
];

const fileTypeOptions = [
    {
        name: "Auto-Detect",
        value: ""
    },
    ...mtFileTypes.map((type) => ({
        name: fileDescriptionMap[type],
        value: type
    })).sort((a, b) => a.name.localeCompare(b.name))
];

export const fileMtDescription: INodeProperties[] = [
    {
        displayName: "Binary Property",
        name: "binaryPropertyName",
        type: "string",
        default: "={{ $('Binary data node').item.binary.data }}",
        required: true,
        description: "Name of the binary property containing the file to translate",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateFile"]
            }
        }
    },
    {
        displayName: "File Type",
        name: "fileType",
        type: "options",
        options: fileTypeOptions,
        default: "",
        required: false,
        description: "The type of the file. Leave as Auto-Detect to determine automatically.",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateFile"]
            }
        }
    },
    {
        displayName: "Source Locale",
        name: "sourceLocale",
        type: "options",
        typeOptions: {
            loadOptionsMethod: "getMtSourceLocales"
        },
        default: "",
        required: false,
        description: "The language code of the source file (e.g., \"en\" for English). Leave blank for auto-detection.",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateFile"]
            }
        }
    },
    {
        displayName: "Target Locales",
        name: "targetLocales",
        type: "multiOptions",
        typeOptions: {
            loadOptionsMethod: "getMtTargetLocales"
        },
        default: [],
        required: true,
        description: "The language codes to which the file will be translated (e.g., \"es\" for Spanish)",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateFile"]
            }
        }
    }
];
