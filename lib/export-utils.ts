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

// 1. Phục hồi JSON phẳng thành JSON lồng nhau (Nested JSON) - GIỮ NGUYÊN
export const unflattenObject = (
    flatObject: Record<string, string>,
): NestedTranslationObject => {
    const result: NestedTranslationObject = {};

    for (const key in flatObject) {
        const parts = key.split(".");
        let current = result;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (i === parts.length - 1) {
                current[part] = flatObject[key];
            } else {
                if (typeof current[part] !== "object") {
                    current[part] = {};
                }
                current = current[part] as NestedTranslationObject;
            }
        }
    }
    return result;
};

// 2. Gom nhóm data từ DB thành cấu trúc file map (NÂNG CẤP BỘ LỌC)
export const buildExportFiles = async (
    projectId: string,
    options?: { languageCodes?: string[] },
) => {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error("Project không tồn tại");

    const namespaces = await db.namespaces.where({ projectId }).toArray();

    // Bỏ qua các row đã bị xóa logic (Soft Delete)
    const rows = await db.translationRows
        .where({ projectId })
        .filter((row) => row.changeStatus !== "deleted")
        .toArray();

    // Xác định danh sách ngôn ngữ sẽ thực xuất ra file
    // Nếu user có truyền mảng chọn lọc từ UI Dialog xuống thì lấy mảng đó, ngược lại lấy tất cả của Project
    const targetLanguages =
        options?.languageCodes && options.languageCodes.length > 0
            ? options.languageCodes
            : project.languages;

    // Cấu trúc: filesMap[langCode][fullPath] = flatData
    const filesMap: Record<string, Record<string, Record<string, string>>> = {};

    targetLanguages.forEach((lang) => {
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

        targetLanguages.forEach((lang) => {
            // Chỉ gán data nếu ngôn ngữ này nằm trong danh sách được chọn export
            if (filesMap[lang] && filesMap[lang][fullPath]) {
                filesMap[lang][fullPath][row.key] = row.values[lang] || "";
            }
        });
    });

    return filesMap;
};

// 3. Zip lại và tải xuống máy người dùng (NÂNG CẤP THAM SỐ OPTIONS)
export const exportProjectAsZip = async (
    projectId: string,
    projectName: string,
    currentVersionName?: string,
    options?: { languageCodes?: string[] }, // THÊM OPTIONS ĐỂ NHẬN DATA TỪ DIALOG
) => {
    // Truyền thẳng options xuống bộ dựng file map
    const filesMap = await buildExportFiles(projectId, options);
    const zip = new JSZip();

    for (const lang in filesMap) {
        // Tạo folder ngôn ngữ gốc (Ví dụ: /en/, /vi/)
        const langFolder = zip.folder(lang);
        if (!langFolder) continue;

        for (const filePath in filesMap[lang]) {
            const flatData = filesMap[lang][filePath];

            // Nếu file rỗng (không có key nào) thì bỏ qua không nén rác vào zip
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
