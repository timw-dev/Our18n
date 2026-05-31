import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "./db";

export type NestedTranslationObject = {
    [key: string]: string | NestedTranslationObject;
};

const formatDateForFileName = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

// 1. Phục hồi JSON phẳng thành JSON lồng nhau (Nested JSON)
export const unflattenObject = (
    flatObject: Record<string, string>,
): NestedTranslationObject => {
    const result: NestedTranslationObject = {};

    for (const key in flatObject) {
        const parts = key.split(".");
        let current = result;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Nếu là node cuối cùng (lá), gán giá trị string
            if (i === parts.length - 1) {
                current[part] = flatObject[key];
            } else {
                // Khởi tạo object rỗng nếu node này chưa tồn tại
                if (typeof current[part] !== "object") {
                    current[part] = {};
                }
                // Chuyển con trỏ đi sâu vào nhánh tiếp theo
                current = current[part] as NestedTranslationObject;
            }
        }
    }
    return result;
};

// 2. Gom nhóm data từ DB thành cấu trúc file map
export const buildExportFiles = async (projectId: string) => {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("Project không tồn tại");

    const namespaces = await db.namespaces.where({ projectId }).toArray();

    // Bỏ qua các row đã bị xóa logic (Soft Delete)
    const rows = await db.translationRows
        .where({ projectId })
        .filter((row) => row.changeStatus !== "deleted")
        .toArray();

    // Cấu trúc: filesMap[langCode][fullPath] = flatData
    const filesMap: Record<string, Record<string, Record<string, string>>> = {};

    project.languages.forEach((lang) => {
        filesMap[lang] = {};
        namespaces.forEach((ns) => {
            const fullPath =
                ns.folderPath === "/"
                    ? ns.fileName
                    : `${ns.folderPath}/${ns.fileName}`;
            filesMap[lang][fullPath] = {};
        });
    });

    rows.forEach((row) => {
        const ns = namespaces.find((n) => n.id === row.namespaceId);
        if (!ns) return;

        const fullPath =
            ns.folderPath === "/"
                ? ns.fileName
                : `${ns.folderPath}/${ns.fileName}`;

        project.languages.forEach((lang) => {
            // Dịch thiếu thì để rỗng (""), không tự fallback để user biết mà dịch tiếp
            filesMap[lang][fullPath][row.key] = row.values[lang] || "";
        });
    });

    return filesMap;
};

// 3. Zip lại và tải xuống máy người dùng
export const exportProjectAsZip = async (
    projectId: string,
    projectName: string,
    currentVersionName?: string,
) => {
    const filesMap = await buildExportFiles(projectId);
    const zip = new JSZip();

    for (const lang in filesMap) {
        // Tạo folder ngôn ngữ gốc (Ví dụ: /en/, /vi/)
        const langFolder = zip.folder(lang);
        if (!langFolder) continue;

        for (const filePath in filesMap[lang]) {
            const flatData = filesMap[lang][filePath];

            // Nếu file rỗng (không có key nào) thì bỏ qua
            if (Object.keys(flatData).length === 0) continue;

            const unflattenedData = unflattenObject(flatData);

            // Pretty Print JSON với indent 2 spaces
            const jsonString = JSON.stringify(unflattenedData, null, 2);
            langFolder.file(filePath, jsonString);
        }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const safeName = projectName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const versionSuffix = currentVersionName ? `_${currentVersionName}` : "";
    saveAs(
        blob,
        `our18n_${safeName}${versionSuffix}_${formatDateForFileName()}.zip`,
    );
};
