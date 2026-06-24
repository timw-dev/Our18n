import { v4 as uuidv4 } from "uuid";
import { db, type TranslationRow, type SnapshotRow } from "./db";
import { useAppStore } from "@/app/store/useAppStore";
import { useUndoStore } from "@/app/store/useUndoStore";

function bumpPatchVersion(currentVersion: string): string {
    const parts = currentVersion.split(".");
    if (parts.length !== 3) return "0.0.1";

    const patch = parseInt(parts[2], 10);
    if (isNaN(patch)) return "0.0.1";

    parts[2] = (patch + 1).toString();
    return parts.join(".");
}

export const createSnapshot = async (
    projectId: string,
    name: string,
    description: string = "",
) => {
    return await db.transaction(
        "rw",
        db.versions,
        db.translationRows,
        async () => {
            const now = new Date().toISOString();
            const currentRows = await db.translationRows
                .where({ projectId })
                .toArray();

            const changeCount = currentRows.filter(
                (row) => row.changeStatus !== "unchanged",
            ).length;

            // FIX 1: Đếm số lượng thực tế sẽ hiển thị (Không tính dòng chờ xóa)
            const activeRowCount = currentRows.filter(
                (row) => row.changeStatus !== "deleted",
            ).length;

            const existingVersions = await db.versions
                .where({ projectId })
                .sortBy("createdAt");
            const latestRecord = existingVersions[existingVersions.length - 1];
            const nextVersion = latestRecord
                ? bumpPatchVersion(latestRecord.version)
                : "0.0.1";

            const snapshotData: SnapshotRow[] = currentRows.map((row) => ({
                id: row.id,
                namespaceId: row.namespaceId,
                key: row.key,
                values: { ...row.values },
                originalValues: { ...row.originalValues },
                changeStatus: row.changeStatus,
                cellMeta: row.cellMeta
                    ? JSON.parse(JSON.stringify(row.cellMeta))
                    : undefined,
            }));

            const versionId = uuidv4();
            await db.versions.add({
                id: versionId,
                projectId,
                version: nextVersion,
                name,
                description,
                type: "snapshot",
                createdAt: now,
                updatedAt: now,
                rowCount: activeRowCount, // Lưu con số chuẩn vào DB
                changeCount,
                snapshot: snapshotData,
            });

            const rowsToUpdate: TranslationRow[] = [];
            const rowIdsToDelete: string[] = [];

            for (const row of currentRows) {
                if (row.changeStatus === "deleted") {
                    rowIdsToDelete.push(row.id);
                } else if (row.changeStatus !== "unchanged") {
                    rowsToUpdate.push({
                        ...row,
                        originalValues: { ...row.values },
                        changeStatus: "unchanged" as const,
                        cellMeta: row.cellMeta ? Object.fromEntries(
                            Object.entries(row.cellMeta).map(([lang, meta]) => [lang, {
                                ...meta,
                                changeStatus: "unchanged" as const,
                            }]),
                        ) : undefined,
                        updatedAt: now,
                    });
                }
            }

            if (rowIdsToDelete.length > 0) {
                await db.translationRows.bulkDelete(rowIdsToDelete);
            }
            if (rowsToUpdate.length > 0) {
                await db.translationRows.bulkPut(rowsToUpdate);
            }

            useUndoStore.getState().clearUndo();
            useAppStore.getState().setActiveVersion(versionId);

            return {
                success: true,
                versionId,
                version: nextVersion,
                changeCount,
            };
        },
    );
};

export const restoreSnapshot = async (projectId: string, versionId: string) => {
    // FIX 2: Bỏ db.namespaces ra khỏi transaction, tuyệt đối KHÔNG XÓA namespace để bảo toàn dữ liệu gốc
    return await db.transaction(
        "rw",
        db.translationRows,
        db.versions,
        async () => {
            const version = await db.versions.get(versionId);
            if (!version)
                throw new Error("Không tìm thấy phiên bản này trong dữ liệu.");

            const keysToDelete = await db.translationRows
                .where({ projectId })
                .primaryKeys();
            if (keysToDelete.length > 0) {
                await db.translationRows.bulkDelete(keysToDelete);
            }

            const now = new Date().toISOString();
            const rowsToRestore: TranslationRow[] = [];

            for (const snapRow of version.snapshot) {
                if (snapRow.changeStatus === "deleted") continue;

                rowsToRestore.push({
                    id: snapRow.id,
                    projectId,
                    namespaceId: snapRow.namespaceId,
                    key: snapRow.key,
                    values: { ...snapRow.values },
                    originalValues: { ...snapRow.values },
                    changeStatus: "unchanged",
                    cellMeta: snapRow.cellMeta
                        ? JSON.parse(JSON.stringify(snapRow.cellMeta))
                        : undefined,
                    translationStatus: {},
                    createdAt: now,
                    updatedAt: now,
                });
            }

            if (rowsToRestore.length > 0) {
                await db.translationRows.bulkAdd(rowsToRestore);
            }
            useAppStore.getState().setActiveVersion(versionId);
            return version;
        },
    );
};
export const deleteSnapshot = async (versionId: string) => {
    return await db.versions.delete(versionId);
};
