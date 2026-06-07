import { v4 as uuidv4 } from "uuid";
import { db, type TranslationRow, type Namespace } from "./db";
import { flattenJSON } from "./json-utils";
import { getTranslationStatus } from "./translation-utils";

// ==========================================
// THÊM MỚI: ĐỊNH NGHĨA CẤU TRÚC PREVIEW ROW THEO KEY (STEP 1)
// ==========================================
export interface PreviewRow {
    id: string; // ID dòng dịch thuật tương ứng
    namespaceId: string; // ID của namespace chứa key này
    namespacePath: string; // Đường dẫn file thân thiện (VD: auth/login.json)
    key: string; // Từ khóa bản dịch
    values: Record<string, string>; // Tập hợp song song đa ngôn ngữ { en: "...", vi: "..." }
    localValues?: Record<string, string>; // Giá trị cũ đang có trên máy (phục vụ đối chiếu khi update/conflict)
    status: "added" | "updated" | "deleted" | "conflicted"; // Trạng thái gom nhóm của dòng
}

export interface ConflictItem {
    id: string;
    rowId: string;
    namespaceId: string;
    key: string;
    lang: string;
    localValue: string;
    incomingValue: string;
    namespacePath: string;
}

// Cấu trúc dữ liệu Commit được nâng cấp để ôm thêm mảng previewRows chuẩn hóa
export interface PendingCommitData {
    projectId: string;
    detectedLanguages: Set<string>;
    newNamespaces: Namespace[];
    newRows: TranslationRow[];
    rowsToUpdate: TranslationRow[];
    conflicts: ConflictItem[];
    previewRows: PreviewRow[]; // MỚI: Mảng dữ liệu theo dòng phục vụ Mini Spreadsheet UI
}

export interface ImportPreviewResult {
    importedCount: number;
    skippedCount: number;
    warnings: string[];
    diffSummary: {
        added: number;
        updated: number;
        unchanged: number;
        conflicted: number;
    };
    pendingData: PendingCommitData | null;
}

// ==========================================
// 1. HÀM BÓC TÁCH FILE JS (ES6 / CommonJS) - GIỮ NGUYÊN
// ==========================================
const parseJavaScriptTranslation = (fileContent: string) => {
    try {
        let code = fileContent
            .replace(/export\s+default\s+/g, "")
            .replace(/module\.exports\s*=\s*/g, "")
            .trim();

        const firstBraceIndex = code.indexOf("{");
        if (firstBraceIndex === -1)
            throw new Error("Không tìm thấy cấu trúc Object hợp lệ");

        code = code.substring(firstBraceIndex);
        code = code.replace(/;+$/, "").trim();

        return new Function(`return ${code}`)();
    } catch (error) {
        throw new Error(`Parse JS thất bại: ${(error as Error).message}`);
    }
};

// ==========================================
// 2. HÀM DETECT LANGUAGE & NAMESPACE - GIỮ NGUYÊN
// ==========================================
export const detectLanguageAndNamespace = (
    filePath: string,
    fallbackLang?: string,
) => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const parts = normalizedPath.split("/");
    const fileName = parts.pop() || normalizedPath;

    let detectedLang = fallbackLang;
    let namespaceParts: string[] = [...parts];
    const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;

    let langIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        if (langRegex.test(parts[i])) {
            detectedLang = parts[i];
            langIndex = i;
            break;
        }
    }

    if (langIndex !== -1) namespaceParts = parts.slice(langIndex + 1);

    const folderPath =
        namespaceParts.length > 0 ? namespaceParts.join("/") : "/";
    const namespace =
        namespaceParts.length > 0 ? `${folderPath}/${fileName}` : fileName;

    return { lang: detectedLang, folderPath, fileName, namespace };
};

// ==========================================
// 3. PHASE 1: ANALYZE & DIFF ENGINE (NÂNG CẤP MODEL)
// ==========================================
export const analyzeImportedFiles = async (
    projectId: string,
    fallbackLangCode: string,
    files: File[],
): Promise<ImportPreviewResult> => {
    const parsedFilesData = [];
    const detectedLanguages = new Set<string>();
    let importedCount = 0,
        skippedCount = 0;
    const warnings: string[] = [];

    const SILENT_IGNORE_FILES = [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "jsconfig.json",
        "i18n.js",
        "next-i18next.config.js",
        "next.config.js",
    ];
    const SILENT_IGNORE_EXTENSIONS = [".md", ".ts", ".jsx", ".tsx", ".txt"];

    // --- BƯỚC 1: ĐỌC FILES ---
    for (const file of files) {
        const dropzoneFile = file as File & { path?: string };
        let relativePath =
            dropzoneFile.path || file.webkitRelativePath || file.name;
        if (relativePath.startsWith("/"))
            relativePath = relativePath.substring(1);
        const lowerName = file.name.toLowerCase();

        if (
            SILENT_IGNORE_FILES.includes(lowerName) ||
            SILENT_IGNORE_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) ||
            lowerName.startsWith(".")
        ) {
            skippedCount++;
            continue;
        }
        if (!lowerName.endsWith(".json") && !lowerName.endsWith(".js")) {
            skippedCount++;
            warnings.push(`Không hỗ trợ: ${relativePath}`);
            continue;
        }
        const { lang, folderPath, fileName, namespace } =
            detectLanguageAndNamespace(relativePath, fallbackLangCode);
        if (!lang) {
            skippedCount++;
            warnings.push(`Không nhận diện được NN: ${relativePath}`);
            continue;
        }

        detectedLanguages.add(lang);
        try {
            const text = await file.text();
            const rawJson = lowerName.endsWith(".js")
                ? parseJavaScriptTranslation(text)
                : JSON.parse(text);
            const flattened = flattenJSON(rawJson);
            parsedFilesData.push({
                lang,
                folderPath,
                fileName,
                namespace,
                flattened,
            });
            importedCount++;
        } catch (error) {
            skippedCount++;
            warnings.push(
                `Lỗi parse ${relativePath}: ${(error as Error).message}`,
            );
        }
    }

    if (parsedFilesData.length === 0) {
        return {
            importedCount,
            skippedCount,
            warnings,
            diffSummary: { added: 0, updated: 0, unchanged: 0, conflicted: 0 },
            pendingData: null,
        };
    }

    // --- BƯỚC 1.5: GOM NHÓM DỮ LIỆU TỪ NHIỀU FILE ---
    const incomingData = new Map<string, Map<string, Record<string, string>>>();
    const namespaceMeta = new Map<
        string,
        { folderPath: string; fileName: string }
    >();

    for (const data of parsedFilesData) {
        const { lang, folderPath, fileName, flattened } = data;
        const nsKey = `${folderPath}/${fileName}`;

        if (!incomingData.has(nsKey)) {
            incomingData.set(nsKey, new Map());
            namespaceMeta.set(nsKey, { folderPath, fileName });
        }
        const keyMap = incomingData.get(nsKey)!;

        for (const [key, value] of Object.entries(flattened)) {
            if (!keyMap.has(key)) keyMap.set(key, {});
            keyMap.get(key)![lang] =
                typeof value === "string" ? value : String(value);
        }
    }

    // --- BƯỚC 2: TÌM XUNG ĐỘT VÀ TẠO DATA ---
    let addedCount = 0,
        updatedCount = 0,
        unchangedCount = 0;
    const newNamespaces: Namespace[] = [],
        newRows: TranslationRow[] = [],
        rowsToUpdate: TranslationRow[] = [],
        conflicts: ConflictItem[] = [];

    const now = new Date().toISOString();
    const existingNamespaces = await db.namespaces
        .where({ projectId })
        .toArray();
    const namespaceMap = new Map(
        existingNamespaces.map((ns) => [`${ns.folderPath}/${ns.fileName}`, ns]),
    );

    let currentNamespaceOrder = existingNamespaces.length;

    for (const [nsKey, keyMap] of incomingData.entries()) {
        const meta = namespaceMeta.get(nsKey)!;

        let namespaceRecord = namespaceMap.get(nsKey);
        if (!namespaceRecord) {
            namespaceRecord = {
                id: uuidv4(),
                projectId,
                folderPath: meta.folderPath,
                fileName: meta.fileName,
                orderIndex: currentNamespaceOrder,
            };
            currentNamespaceOrder++;
            namespaceMap.set(nsKey, namespaceRecord);
            newNamespaces.push(namespaceRecord);
        }

        const existingRows = await db.translationRows
            .where({ projectId, namespaceId: namespaceRecord.id })
            .toArray();
        const existingRowMap = new Map(
            existingRows.map((row) => [row.key, row]),
        );

        let currentKeyOrder = existingRows.length;

        for (const [key, langValues] of keyMap.entries()) {
            const existingRow = existingRowMap.get(key);

            if (existingRow) {
                let hasAnySafeUpdate = false;
                let isRowUnchanged = true;
                const isDeleted = existingRow.changeStatus === "deleted";

                for (const [lang, incomingValue] of Object.entries(
                    langValues,
                )) {
                    const valueChanged =
                        existingRow.values[lang] !== incomingValue;

                    if (valueChanged || isDeleted) {
                        isRowUnchanged = false;

                        if (existingRow.changeStatus !== "unchanged") {
                            conflicts.push({
                                id: `${existingRow.id}_${lang}`,
                                rowId: existingRow.id,
                                namespaceId: existingRow.namespaceId,
                                key: existingRow.key,
                                lang,
                                localValue: isDeleted
                                    ? "🗑️ [DÒNG NÀY ĐANG BỊ BẠN XÓA]"
                                    : existingRow.values[lang],
                                incomingValue,
                                namespacePath: nsKey,
                            });
                        } else {
                            existingRow.values[lang] = incomingValue;
                            if (!existingRow.translationStatus)
                                existingRow.translationStatus = {};
                            existingRow.translationStatus[lang] =
                                getTranslationStatus(incomingValue);
                            hasAnySafeUpdate = true;
                        }
                    }
                }

                if (isRowUnchanged) {
                    unchangedCount++;
                } else if (hasAnySafeUpdate) {
                    existingRow.changeStatus = "updated";
                    existingRow.updatedAt = now;
                    rowsToUpdate.push(existingRow);
                    updatedCount++;
                }
            } else {
                const newRow: TranslationRow = {
                    id: `${namespaceRecord.id}:${key}`,
                    projectId,
                    namespaceId: namespaceRecord.id,
                    key,
                    values: { ...langValues },
                    originalValues: { ...langValues },
                    translationStatus: {},
                    changeStatus: "added",
                    orderIndex: currentKeyOrder,
                    createdAt: now,
                    updatedAt: now,
                };
                currentKeyOrder++;

                for (const [lang, val] of Object.entries(langValues)) {
                    newRow.translationStatus[lang] = getTranslationStatus(val);
                }

                newRows.push(newRow);
                addedCount++;
            }
        }
    }

    // ==========================================
    // MỚI (STEP 1): ÁNH XẠ SANG MẢNG PREVIEWROWS CHUẨN HÓA THEO KEY
    // ==========================================
    const previewRows: PreviewRow[] = [];
    const idToNsPath = new Map<string, string>();
    existingNamespaces.forEach((n) =>
        idToNsPath.set(n.id, `${n.folderPath}/${n.fileName}`),
    );
    newNamespaces.forEach((n) =>
        idToNsPath.set(n.id, `${n.folderPath}/${n.fileName}`),
    );

    // 1. Ánh xạ các dòng thêm mới
    newRows.forEach((r) => {
        previewRows.push({
            id: r.id,
            namespaceId: r.namespaceId,
            namespacePath: idToNsPath.get(r.namespaceId) || "common.json",
            key: r.key,
            values: { ...r.values },
            status: "added",
        });
    });

    // 2. Ánh xạ các dòng cập nhật an toàn
    rowsToUpdate.forEach((r) => {
        previewRows.push({
            id: r.id,
            namespaceId: r.namespaceId,
            namespacePath: idToNsPath.get(r.namespaceId) || "common.json",
            key: r.key,
            values: { ...r.values },
            localValues: { ...r.originalValues },
            status: "updated",
        });
    });

    // 3. Ánh xạ các dòng có xung đột văn bản (Nhóm theo Key, gộp chung các ngôn ngữ conflict)
    const conflictRowIds = Array.from(new Set(conflicts.map((c) => c.rowId)));
    for (const rId of conflictRowIds) {
        const rowConflicts = conflicts.filter((c) => c.rowId === rId);
        if (rowConflicts.length === 0) continue;

        const baseConflict = rowConflicts[0];
        const combinedIncoming: Record<string, string> = {};
        const combinedLocal: Record<string, string> = {};

        rowConflicts.forEach((c) => {
            combinedIncoming[c.lang] = c.incomingValue;
            combinedLocal[c.lang] = c.localValue;
        });

        previewRows.push({
            id: rId,
            namespaceId: baseConflict.namespaceId,
            namespacePath: baseConflict.namespacePath,
            key: baseConflict.key,
            values: combinedIncoming,
            localValues: combinedLocal,
            status: "conflicted",
        });
    }

    previewRows.sort((a, b) => a.key.localeCompare(b.key));

    return {
        importedCount,
        skippedCount,
        warnings,
        diffSummary: {
            added: addedCount,
            updated: updatedCount,
            unchanged: unchangedCount,
            conflicted: conflicts.length,
        },
        pendingData: {
            projectId,
            detectedLanguages,
            newNamespaces,
            newRows,
            rowsToUpdate,
            conflicts,
            previewRows,
        },
    };
};

// ==========================================
// 4. PHASE 2: COMMIT + RESOLVE CONFLICTS (CẬP NHẬT ĐỂ LƯU DATA INLINE EDIT)
// ==========================================
export const commitImportData = async (
    pendingData: PendingCommitData,
    resolutions: Record<string, "local" | "incoming"> = {},
) => {
    const {
        projectId,
        detectedLanguages,
        newNamespaces,
        newRows,
        rowsToUpdate,
        conflicts,
        previewRows = [], // Lấy mảng previewRows chứa dữ liệu đã sửa tay
    } = pendingData;

    const project = await db.projects.get(projectId);
    if (project) {
        const newLangs = Array.from(detectedLanguages).filter(
            (l) => !project.languages.includes(l),
        );
        if (newLangs.length > 0)
            await db.projects.update(projectId, {
                languages: [...project.languages, ...newLangs],
            });
    }

    await db.transaction("rw", db.namespaces, db.translationRows, async () => {
        // Tạo Map chứa các dòng từ core
        const pendingMap = new Map<string, TranslationRow>();

        // CẬP NHẬT: Ưu tiên lấy giá trị từ previewRows (vì có thể đã được người dùng sửa typo)
        newRows.forEach((r) => {
            const previewVersion = previewRows.find((p) => p.id === r.id);
            if (previewVersion) {
                r.values = { ...previewVersion.values };
                // Đối với hàng thêm mới, giá trị originalValues cũng phải đi theo giá trị sau cùng
                r.originalValues = { ...previewVersion.values };

                // Cập nhật lại mốc trạng thái dịch thuật level cell
                Object.entries(r.values).forEach(([lang, val]) => {
                    r.translationStatus[lang] = getTranslationStatus(val);
                });
            }
            pendingMap.set(r.id, r);
        });

        rowsToUpdate.forEach((r) => {
            const previewVersion = previewRows.find((p) => p.id === r.id);
            if (previewVersion) {
                r.values = { ...previewVersion.values };
                Object.entries(r.values).forEach(([lang, val]) => {
                    if (!r.translationStatus) r.translationStatus = {};
                    r.translationStatus[lang] = getTranslationStatus(val);
                });
            }
            pendingMap.set(r.id, r);
        });

        const resolvedUpdatesMap = new Map<string, TranslationRow>();

        // Xử lý các dòng conflict truyền thống dựa trên bảng lựa chọn resolutions gửi lên
        for (const conflict of conflicts) {
            const choice = resolutions[conflict.id];
            if (!choice) continue;

            if (choice === "incoming") {
                const targetRow =
                    pendingMap.get(conflict.rowId) ||
                    resolvedUpdatesMap.get(conflict.rowId) ||
                    (await db.translationRows.get(conflict.rowId));

                if (targetRow) {
                    // Nếu trong previewRows có bản sửa tay, lấy bản sửa tay, nếu không lấy incomingValue gốc
                    const previewVersion = previewRows.find(
                        (p) => p.id === conflict.rowId,
                    );
                    targetRow.values[conflict.lang] = previewVersion
                        ? previewVersion.values[conflict.lang]
                        : conflict.incomingValue;

                    targetRow.changeStatus = "updated";
                    if (!targetRow.translationStatus)
                        targetRow.translationStatus = {};
                    targetRow.translationStatus[conflict.lang] =
                        getTranslationStatus(targetRow.values[conflict.lang]);
                    targetRow.updatedAt = new Date().toISOString();

                    if (!pendingMap.has(targetRow.id)) {
                        resolvedUpdatesMap.set(targetRow.id, targetRow);
                    }
                }
            }
        }

        // Thực thi ghi dữ liệu đồng loạt vào IndexedDB
        if (newNamespaces.length > 0)
            await db.namespaces.bulkAdd(newNamespaces);
        if (newRows.length > 0) await db.translationRows.bulkAdd(newRows);
        if (rowsToUpdate.length > 0)
            await db.translationRows.bulkPut(rowsToUpdate);
        if (resolvedUpdatesMap.size > 0)
            await db.translationRows.bulkPut(
                Array.from(resolvedUpdatesMap.values()),
            );
    });
};
