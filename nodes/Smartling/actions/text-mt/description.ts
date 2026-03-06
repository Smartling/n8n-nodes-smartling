import type { INodeProperties } from "n8n-workflow";

export const textMtDescription: INodeProperties[] = [
    {
        displayName: "Source Locale",
        name: "sourceLocale",
        type: "options",
        typeOptions: {
            loadOptionsMethod: "getMtLocales"
        },
        default: "",
        required: false,
        description: "The language code of the text to be translated (e.g., \"en\" for English). Leave blank for auto-detection.",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateText"]
            }
        }
    },
    {
        displayName: "Target Locale",
        name: "targetLocale",
        type: "options",
        typeOptions: {
            loadOptionsMethod: "getMtLocales"
        },
        default: "",
        required: true,
        description: "The language code to which the text will be translated (e.g., \"es\" for Spanish)",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateText"]
            }
        }
    },
    {
        displayName: "Source Text",
        name: "sourceText",
        type: "string",
        typeOptions: {
            rows: 4
        },
        default: "",
        required: true,
        description: "Text to translate. For multiple strings, separate with newlines.",
        displayOptions: {
            show: {
                resource: ["machineTranslation"],
                operation: ["translateText"]
            }
        }
    }
];
