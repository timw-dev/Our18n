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

export const clearProjectData = async (projectId: string) => {
    // Giữ lại Project Info, chỉ xóa Data (Namespaces, Rows, Versions)
    // Và reset mảng languages về lại duy nhất ngôn ngữ default
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

            const project = await db.projects.get(projectId);
            if (project) {
                await db.projects.update(projectId, {
                    languages: [project.defaultLanguage],
                });
            }
        },
    );
};

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
