import { db, type TranslationRow } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";

export const translationService = {
    /**
     * Lấy dữ liệu sạch từ IndexedDB đã được sắp xếp mặc định theo Alphabetical (STEP 6)
     */
    async getProjectRows(projectId: string): Promise<TranslationRow[]> {
        if (!projectId) return [];
        try {
            const dataFromDb = await db.translationRows
                .where({ projectId })
                .toArray();

            // Sắp xếp Alphabetical theo đúng đặc tả yêu cầu của PR v0.3.1
            return dataFromDb.sort((a, b) => a.key.localeCompare(b.key));
        } catch (error) {
            console.error("Lỗi khi lấy dữ liệu từ IndexedDB:", error);
            throw error;
        }
    },

    /**
     * Cập nhật giá trị của một ô dịch thuật cụ thể và đưa trạng thái về updated
     */
    async updateCell(
        rowId: string,
        langCode: string,
        newValue: string,
    ): Promise<void> {
        try {
            const row = await db.translationRows.get(rowId);
            if (!row) return;

            const updatedValues = { ...row.values, [langCode]: newValue };
            const isUnchanged =
                JSON.stringify(updatedValues) ===
                JSON.stringify(row.originalValues);

            await db.translationRows.update(rowId, {
                values: updatedValues,
                changeStatus: isUnchanged ? "unchanged" : "updated",
            });

            useAppStore.getState().setActiveVersion(null);
        } catch (error) {
            console.error("Lỗi service khi cập nhật ô bản dịch:", error);
            throw error;
        }
    },
};