import { v4 as uuidv4 } from "uuid";
import { db, type TranslationRow, type Namespace } from "./db";
import { flattenJSON } from "./json-utils";
import { getTranslationStatus } from "./translation-utils";

// Helper function: Tách thông tin từ Path
const extractPathInfo = (relativePath: string, fallbackLang: string) => {
    const parts = relativePath.split("/");
    const fileName = parts.pop() || relativePath;

    let detectedLang = fallbackLang;
    let namespaceParts = [...parts];

    // Regex bắt mã ngôn ngữ: VD: 'en', 'vi', 'ko-KR', 'zh-CN'
    const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;

    for (let i = 0; i < parts.length; i++) {
        if (langRegex.test(parts[i])) {
            detectedLang = parts[i];
            // Cắt lấy toàn bộ các folder NẰM SAU folder ngôn ngữ làm namespace
            namespaceParts = parts.slice(i + 1);
            break;
        }
    }

    const folderPath =
        namespaceParts.length > 0 ? namespaceParts.join("/") : "/";

    return { detectedLang, folderPath, fileName };
};

export const processImportedFiles = async (
    projectId: string,
    fallbackLangCode: string, // Đổi tên để rõ nghĩa: Đây là fallback từ Dropdown UI
    files: File[],
) => {
    const parsedFilesData: {
        detectedLang: string;
        folderPath: string;
        fileName: string;
        flattened: Record<string, string>;
    }[] = [];
    const detectedLanguages = new Set<string>(); // Lưu danh sách các ngôn ngữ có trong đợt upload này

    // ==========================================
    // BƯỚC 1: XỬ LÝ ASYNC BÊN NGOÀI TRANSACTION
    // ==========================================
    for (const file of files) {
        if (!file.name.endsWith(".json")) continue;

        const relativePath = file.webkitRelativePath || file.name;

        // Auto-detect lang & namespace
        const { detectedLang, folderPath, fileName } = extractPathInfo(
            relativePath,
            fallbackLangCode,
        );

        detectedLanguages.add(detectedLang);

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const flattened = flattenJSON(json);

            parsedFilesData.push({
                detectedLang,
                folderPath,
                fileName,
                flattened,
            });
        } catch (error) {
            console.error(`Lỗi khi đọc file ${file.name}:`, error);
        }
    }

    if (parsedFilesData.length === 0) return;

    // ==========================================
    // BƯỚC 2: CẬP NHẬT NGÔN NGỮ CHO PROJECT
    // ==========================================
    const project = await db.projects.get(projectId);
    if (project) {
        const newLangs = Array.from(detectedLanguages).filter(
            (l) => !project.languages.includes(l),
        );
        if (newLangs.length > 0) {
            await db.projects.update(projectId, {
                languages: [...project.languages, ...newLangs],
            });
        }
    }

    // ==========================================
    // BƯỚC 3: MỞ TRANSACTION ĐỂ GHI NHANH VÀO DB
    // ==========================================
    await db.transaction("rw", db.namespaces, db.translationRows, async () => {
        const now = new Date().toISOString();

        for (const data of parsedFilesData) {
            const { detectedLang, folderPath, fileName, flattened } = data;

            const existingNamespaces = await db.namespaces
                .where({ projectId })
                .toArray();
            let namespace = existingNamespaces.find(
                (ns) =>
                    ns.folderPath === folderPath && ns.fileName === fileName,
            );

            if (!namespace) {
                namespace = {
                    id: uuidv4(),
                    projectId,
                    folderPath,
                    fileName,
                };
                await db.namespaces.add(namespace);
            }

            const existingRows = await db.translationRows
                .where({ namespaceId: namespace.id })
                .toArray();
            const existingRowMap = new Map(
                existingRows.map((row) => [row.key, row]),
            );

            const newRows: TranslationRow[] = [];
            const rowsToUpdate: TranslationRow[] = [];

            for (const [key, value] of Object.entries(flattened)) {
                const existingRow = existingRowMap.get(key);

                if (existingRow) {
                    // Ghi đè vào cột ngôn ngữ detect được (không dùng cứng fallbackLangCode nữa)
                    existingRow.values[detectedLang] = value;
                    existingRow.originalValues[detectedLang] = value;

                    if (!existingRow.translationStatus)
                        existingRow.translationStatus = {};
                    existingRow.translationStatus[detectedLang] =
                        getTranslationStatus(value);

                    existingRow.updatedAt = now;
                    rowsToUpdate.push(existingRow);
                } else {
                    newRows.push({
                        id: `${namespace.id}:${key}`,
                        projectId,
                        namespaceId: namespace!.id,
                        key,
                        values: { [detectedLang]: value },
                        originalValues: { [detectedLang]: value },
                        translationStatus: {
                            [detectedLang]: getTranslationStatus(value),
                        },
                        changeStatus: "unchanged",
                        createdAt: now,
                        updatedAt: now,
                    });
                }
            }

            if (newRows.length > 0) await db.translationRows.bulkAdd(newRows);
            if (rowsToUpdate.length > 0)
                await db.translationRows.bulkPut(rowsToUpdate);
        }
    });
};
