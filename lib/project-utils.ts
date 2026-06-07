import { v4 as uuidv4 } from "uuid";
import { db } from "./db";

export const createProject = async (
    name: string,
    defaultLanguage: string = "en",
) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.projects.add({
        id,
        name,
        defaultLanguage,
        languages: [defaultLanguage],
        createdAt: now,
        updatedAt: now,
    });
    return id;
};

export const renameProject = async (projectId: string, newName: string) => {
    await db.projects.update(projectId, {
        name: newName,
        updatedAt: new Date().toISOString(),
    });
};

export async function clearProjectData(projectId: string): Promise<void> {
    await db.transaction(
        "rw",
        [db.translationRows, db.namespaces, db.versions],
        async () => {
            // 1. Xóa sạch hàng dịch
            await db.translationRows.where({ projectId }).delete();

            // 2. Xóa sạch cấu trúc tệp tin của dự án này (Để lần sau import tính lại từ đầu)
            await db.namespaces.where({ projectId }).delete();

            // 3. Xóa sạch lịch sử snapshot
            await db.versions.where({ projectId }).delete();
        },
    );
}

export const deleteProject = async (projectId: string) => {
    // Xóa sạch bách (Cascade Delete)
    await db.transaction(
        "rw",
        db.projects,
        db.namespaces,
        db.translationRows,
        db.versions,
        async () => {
            await db.translationRows.where({ projectId }).delete();
            await db.namespaces.where({ projectId }).delete();
            await db.versions.where({ projectId }).delete();
            await db.projects.delete(projectId);
        },
    );
};
