import { FileType } from "./file-types";

const fileExtensionsMap: Record<string, FileType> = {
    ".strings": FileType.IOS,
    ".xcstrings": FileType.XCSTRINGS,
    ".po": FileType.GETTEXT,
    ".pot": FileType.GETTEXT,
    ".html": FileType.HTML,
    ".htm": FileType.HTML,
    ".properties": FileType.JAVA_PROPERTIES,
    ".xliff": FileType.XLIFF,
    ".xlf": FileType.XLIFF,
    ".json": FileType.JSON,
    ".docx": FileType.DOCX,
    ".pptx": FileType.PPTX,
    ".xlsx": FileType.XLSX,
    ".idml": FileType.IDML,
    ".idms": FileType.IDML,
    ".indd": FileType.INDD,
    ".indt": FileType.INDD,
    ".ts": FileType.QT,
    ".resx": FileType.RESX,
    ".resw": FileType.RESX,
    ".txt": FileType.PLAIN_TEXT,
    ".csv": FileType.CSV,
    ".srt": FileType.SRT,
    ".stringsdict": FileType.STRINGSDICT,
    ".xls": FileType.XLS,
    ".doc": FileType.DOC,
    ".ppt": FileType.PPT,
    ".pres": FileType.PRES,
    ".yaml": FileType.YAML,
    ".yml": FileType.YAML,
    ".markdown": FileType.MARKDOWN,
    ".md": FileType.MARKDOWN
};

export const getFileTypeByExtension = (fileExt: string): FileType | undefined => fileExtensionsMap[fileExt.toLowerCase()];
