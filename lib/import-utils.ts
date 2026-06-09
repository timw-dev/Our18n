import { v4 as uuidv4 } from "uuid";
import { db, type TranslationRow, type Namespace } from "./db";
import { flattenJSON } from "./json-utils";
import { getTranslationStatus } from "./translation-utils";

export interface PreviewRow {
    id: string;
    namespaceId: string;
    namespacePath: string;
    key: string;
    values: Record<string, string>;
    localValues?: Record<string, string>;
    status: "added" | "updated" | "deleted" | "conflicted";
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

export interface PendingCommitData {
    projectId: string;
    detectedLanguages: Set<string>;
    newNamespaces: Namespace[];
    newRows: TranslationRow[];
    rowsToUpdate: TranslationRow[];
    conflicts: ConflictItem[];
    previewRows: PreviewRow[];
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

    const currentProject = await db.projects.get(projectId);
    const allowedLanguages = currentProject?.languages || [];

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
            warnings.push(`Không hỗ trợ định dạng: ${relativePath}`);
            continue;
        }
        const { lang, folderPath, fileName, namespace } =
            detectLanguageAndNamespace(relativePath, fallbackLangCode);

        if (!lang) {
            skippedCount++;
            warnings.push(`Không nhận diện được mã ngôn ngữ: ${relativePath}`);
            continue;
        }

        // ĐÃ GỠ BỎ BLOCK CHẶN NGÔN NGỮ LẠ: Cho phép nhận diện toàn bộ ngôn ngữ nạp vào
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
                `Lỗi cấu trúc tệp ${relativePath}: ${(error as Error).message}`,
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

    // --- MỚI: TẠO DANH SÁCH CỘT TỔNG HỢP (UNIFIED COLUMNS) ---
    // Danh sách hiển thị = Ngôn ngữ project đang có + Ngôn ngữ mới phát hiện từ file
    const allPreviewLanguages = new Set([
        ...allowedLanguages,
        ...detectedLanguages,
    ]);

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
        unchangedCount = 0,
        conflictedCount = 0;

    const newNamespaces: Namespace[] = [],
        newRows: TranslationRow[] = [],
        rowsToUpdate: TranslationRow[] = [],
        conflicts: ConflictItem[] = [],
        previewRows: PreviewRow[] = [];

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
                let hasAnyConflict = false;
                let isRowUnchanged = true;
                const isDeleted = existingRow.changeStatus === "deleted";

                // Chuẩn bị khung dữ liệu phẳng để show lên UI
                const localValuesForUi: Record<string, string> = {};
                const incomingValuesForUi: Record<string, string> = {};

                // Đảm bảo Preview Row chứa đủ cột của mọi ngôn ngữ (Kể cả bị thiếu trong file)
                allPreviewLanguages.forEach((lang) => {
                    localValuesForUi[lang] = existingRow.values[lang] || "";
                    incomingValuesForUi[lang] = existingRow.values[lang] || "";
                });

                for (const [lang, incomingValue] of Object.entries(
                    langValues,
                )) {
                    const localValue = existingRow.values[lang] || "";
                    const valueChanged = localValue !== incomingValue;

                    if (valueChanged || isDeleted) {
                        isRowUnchanged = false;
                        incomingValuesForUi[lang] = incomingValue;

                        if (
                            existingRow.changeStatus !== "unchanged" &&
                            localValue !== ""
                        ) {
                            hasAnyConflict = true;
                            conflicts.push({
                                id: `${existingRow.id}_${lang}`,
                                rowId: existingRow.id,
                                namespaceId: existingRow.namespaceId,
                                key: existingRow.key,
                                lang,
                                localValue: isDeleted
                                    ? "🗑️ [DÒNG NÀY ĐANG BỊ BẠN XÓA]"
                                    : localValue,
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
                } else {
                    previewRows.push({
                        id: existingRow.id,
                        namespaceId: existingRow.namespaceId,
                        namespacePath: nsKey,
                        key: existingRow.key,
                        values: incomingValuesForUi,
                        localValues: localValuesForUi,
                        status: hasAnyConflict ? "conflicted" : "updated",
                    });

                    if (hasAnyConflict) {
                        existingRow.changeStatus = "conflicted";
                        existingRow.updatedAt = now;
                        rowsToUpdate.push(existingRow);
                        conflictedCount++;
                    } else if (hasAnySafeUpdate) {
                        existingRow.changeStatus = "updated";
                        existingRow.updatedAt = now;
                        rowsToUpdate.push(existingRow);
                        updatedCount++;
                    }
                }
            } else {
                // HÀNG THÊM MỚI TINH (ADDED)
                const finalLangValues: Record<string, string> = {};
                allPreviewLanguages.forEach((lang) => {
                    finalLangValues[lang] = langValues[lang] || "";
                });

                const newRow: TranslationRow = {
                    id: `${namespaceRecord.id}:${key}`,
                    projectId,
                    namespaceId: namespaceRecord.id,
                    key,
                    values: finalLangValues,
                    originalValues: finalLangValues,
                    translationStatus: {},
                    changeStatus: "added",
                    orderIndex: currentKeyOrder,
                    createdAt: now,
                    updatedAt: now,
                };
                currentKeyOrder++;

                for (const [lang, val] of Object.entries(finalLangValues)) {
                    if (val)
                        newRow.translationStatus[lang] =
                            getTranslationStatus(val);
                }

                newRows.push(newRow);
                addedCount++;

                previewRows.push({
                    id: newRow.id,
                    namespaceId: newRow.namespaceId,
                    namespacePath: nsKey,
                    key: newRow.key,
                    values: finalLangValues,
                    status: "added",
                });
            }
        }
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
            conflicted: conflictedCount,
        },
        pendingData: {
            projectId,
            detectedLanguages: allPreviewLanguages, // TRUYỀN TỔNG HỢP ĐỂ BẢNG UI HIỂN THỊ ĐỦ CỘT
            newNamespaces,
            newRows,
            rowsToUpdate,
            conflicts,
            previewRows,
        },
    };
};

export const commitImportData = async (
    pendingData: PendingCommitData,
    resolutions: Record<string, "local" | "incoming"> = {},
) => {
    const {
        projectId, // Đảm bảo lấy projectId để update ngôn ngữ
        detectedLanguages,
        newNamespaces,
        newRows,
        rowsToUpdate,
        conflicts,
        previewRows = [],
    } = pendingData;

    // --- CHÍNH THỨC ĐĂNG KÝ NGÔN NGỮ MỚI VÀO DỰ ÁN ---
    const project = await db.projects.get(projectId);
    if (project) {
        const newLangs = Array.from(detectedLanguages).filter(
            (l) => !project.languages.includes(l),
        );
        // Chỉ khi user bấm Apply, hệ thống mới ghi đè các cột mới phát hiện vào danh sách ngôn ngữ
        if (newLangs.length > 0) {
            await db.projects.update(projectId, {
                languages: [...project.languages, ...newLangs],
                updatedAt: new Date().toISOString(),
            });
        }
    }

    await db.transaction("rw", db.namespaces, db.translationRows, async () => {
        const pendingMap = new Map<string, TranslationRow>();

        newRows.forEach((r) => {
            const previewVersion = previewRows.find((p) => p.id === r.id);
            if (previewVersion) {
                r.values = { ...previewVersion.values };
                r.originalValues = { ...previewVersion.values };
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

        for (const conflict of conflicts) {
            const choice = resolutions[conflict.id];
            if (!choice) continue;

            if (choice === "incoming") {
                const targetRow =
                    pendingMap.get(conflict.rowId) ||
                    resolvedUpdatesMap.get(conflict.rowId) ||
                    (await db.translationRows.get(conflict.rowId));

                if (targetRow) {
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

        if (newNamespaces.length > 0)
            await db.namespaces.bulkAdd(newNamespaces);
        if (newRows.length > 0) await db.translationRows.bulkAdd(newRows);
        if (rowsToUpdate.length > 0)
            await db.translationRows.bulkPut(rowsToUpdate);
        if (resolvedUpdatesMap.size > 0) {
            await db.translationRows.bulkPut(
                Array.from(resolvedUpdatesMap.values()),
            );
        }
    });
};
