import Dexie, { type Table } from "dexie";

export type TranslationStatus =
    | "missing"
    | "draft"
    | "translated"
    | "reviewed"
    | "approved";
export type ChangeStatus =
    | "unchanged"
    | "added"
    | "updated"
    | "deleted"
    | "conflicted";

export interface Project {
    id: string;
    name: string;
    defaultLanguage: string;
    languages: string[];
    createdAt: string;
    updatedAt: string;
}

export interface Namespace {
    id: string; // VD: "project1_admin_auth.json"
    projectId: string;
    folderPath: string;
    fileName: string;
}

export interface TranslationRow {
    id: string;
    projectId: string;
    namespaceId: string;
    key: string;

    values: Record<string, string>;
    originalValues: Record<string, string>;

    // Trạng thái level ROW (Giữ lại cho tương thích ngược & filter tổng)
    translationStatus: Record<string, TranslationStatus>;
    changeStatus: ChangeStatus;

    // MỚI: Trạng thái level CELL (Sẵn sàng cho Phase 2)
    cellMeta?: Record<
        string,
        {
            changeStatus?: ChangeStatus;
            translationStatus?: TranslationStatus;
        }
    >;

    createdAt: string;
    updatedAt: string;
}

export class I18nManagerDB extends Dexie {
    projects!: Table<Project, string>;
    namespaces!: Table<Namespace, string>;
    translationRows!: Table<TranslationRow, string>;

    // Versions và Changes sẽ được thêm vào ở Phase 2
    // versions!: Table<Version, string>;
    // changes!: Table<ChangeRecord, string>;

    constructor() {
        super("I18nManagerDB");

        // Định nghĩa Schema (chỉ liệt kê những field cần đánh index để search/filter)
        this.version(1).stores({
            projects: "id, name, updatedAt",
            namespaces: "id, projectId, [projectId+folderPath], fileName",
            // Compound index [projectId+namespaceId] giúp query Table cực nhanh
            translationRows:
                "id, projectId, namespaceId, [projectId+namespaceId], key, changeStatus, updatedAt",
        });
    }
}

export const updateTranslationCell = async (
    rowId: string,
    langCode: string,
    newValue: string,
) => {
    const row = await db.translationRows.get(rowId);
    if (!row) return;

    const originalValue = row.originalValues[langCode] || "";
    const isChanged = newValue !== originalValue;

    // Sửa trực tiếp trên object rồi dùng .put() đè lên
    row.values[langCode] = newValue;
    row.translationStatus[langCode] = newValue.trim()
        ? "translated"
        : "missing";
    row.changeStatus = isChanged ? "updated" : "unchanged";
    row.updatedAt = new Date().toISOString();

    await db.translationRows.put(row);
};

export interface ProjectVersion {
    id: string;
    projectId: string;
    name: string; // Tên snapshot (VD: "Dịch xong Header")
    description?: string;
    createdAt: string;
}

class I18nDatabase extends Dexie {
    projects!: Dexie.Table<Project, string>;
    namespaces!: Dexie.Table<Namespace, string>;
    translationRows!: Dexie.Table<TranslationRow, string>;
    versions!: Dexie.Table<ProjectVersion, string>; // Khai báo bảng mới

    constructor() {
        super("I18nManagerDB");

        // 2. QUAN TRỌNG: Tăng version từ 1 lên 2.
        // Bổ sung bảng versions vào schema.
        this.version(2).stores({
            projects: "id, createdAt",
            namespaces: "id, projectId, [projectId+folderPath+fileName]",
            translationRows:
                "id, projectId, namespaceId, changeStatus, [projectId+namespaceId]",
            versions: "id, projectId, createdAt", // Đánh index để sau này query theo ngày tháng
        });
    }
}

export const db = new I18nDatabase();
