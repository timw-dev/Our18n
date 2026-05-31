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

export interface SnapshotRow {
    id: string;
    namespaceId: string;
    key: string;
    values: Record<string, string>;
    originalValues: Record<string, string>;
    changeStatus: ChangeStatus;
    cellMeta?: TranslationRow["cellMeta"];
}

export interface VersionRecord {
    id: string;
    projectId: string;
    version: string;
    name: string;
    description?: string;
    type?: "snapshot" | "import" | "rollback";
    createdAt: string;
    updatedAt?: string;
    rowCount: number;
    changeCount: number;
    snapshot: SnapshotRow[];
}

export async function updateTranslationCell(
    rowId: string,
    langCode: string,
    value: string,
) {
    const row = await db.translationRows.get(rowId);

    if (!row) {
        throw new Error("Translation row not found");
    }

    const nextValues = {
        ...row.values,
        [langCode]: value,
    };

    const hasAnyChanged = Object.keys(nextValues).some((lang) => {
        return (nextValues[lang] || "") !== (row.originalValues?.[lang] || "");
    });

    let nextChangeStatus = row.changeStatus;

    if (row.changeStatus === "added" || row.changeStatus === "deleted") {
        nextChangeStatus = row.changeStatus;
    } else {
        nextChangeStatus = hasAnyChanged ? "updated" : "unchanged";
    }

    const nextCellChangeStatus: ChangeStatus =
        value !== (row.originalValues?.[langCode] || "")
            ? "updated"
            : "unchanged";

    const nextTranslationStatus: TranslationStatus = value.trim()
        ? "translated"
        : "missing";

    const nextCellMeta: NonNullable<TranslationRow["cellMeta"]> = {
        ...(row.cellMeta ?? {}),
        [langCode]: {
            ...(row.cellMeta?.[langCode] ?? {}),
            changeStatus: nextCellChangeStatus,
            translationStatus: nextTranslationStatus,
        },
    };

    await db.translationRows.update(rowId, {
        values: nextValues,
        cellMeta: nextCellMeta,
        changeStatus: nextChangeStatus,
        updatedAt: new Date().toISOString(),
    });
}

export interface ProjectVersion {
    id: string;
    projectId: string;
    name: string; // Tên snapshot (VD: "Dịch xong Header")
    description?: string;
    createdAt: string;
}

export class I18nDatabase extends Dexie {
    projects!: Table<Project, string>;
    namespaces!: Table<Namespace, string>;
    translationRows!: Table<TranslationRow, string>;
    versions!: Table<VersionRecord, string>;

    constructor() {
        super("I18nManagerDB");

        this.version(1).stores({
            projects: "id, name, updatedAt",
            namespaces: "id, projectId, [projectId+folderPath], fileName",
            translationRows:
                "id, projectId, namespaceId, [projectId+namespaceId], key, changeStatus, updatedAt",
        });

        this.version(2).stores({
            projects: "id, name, updatedAt",
            namespaces:
                "id, projectId, [projectId+folderPath], [projectId+folderPath+fileName], fileName",
            translationRows:
                "id, projectId, namespaceId, [projectId+namespaceId], key, changeStatus, updatedAt",
            versions: "id, projectId, createdAt",
        });

        // BUMP VERSION 3: Bổ sung index cho bảng versions
        this.version(3).stores({
            projects: "id, name, updatedAt",
            namespaces:
                "id, projectId, [projectId+folderPath], [projectId+folderPath+fileName], fileName",
            translationRows:
                "id, projectId, namespaceId, [projectId+namespaceId], key, changeStatus, updatedAt",
            versions:
                "id, projectId, version, createdAt, [projectId+createdAt], [projectId+version]",
        });
    }
}

export const db = new I18nDatabase();
