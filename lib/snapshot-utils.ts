import { v4 as uuidv4 } from "uuid";
import { db } from "./db";

export const createSnapshot = async (
    projectId: string,
    name: string,
    description: string = "",
) => {
    // Mở transaction bọc 2 bảng để đảm bảo an toàn toàn vẹn dữ liệu (ACID)
    return await db.transaction(
        "rw",
        db.versions,
        db.translationRows,
        async () => {
            const now = new Date().toISOString();

            // 1. Khởi tạo Record lịch sử
            const versionId = uuidv4();
            await db.versions.add({
                id: versionId,
                projectId,
                name,
                description,
                createdAt: now,
            });

            // 2. Tìm tất cả các dòng đang bị sửa/thêm mới (Updated / Added)
            const changedRows = await db.translationRows
                .where({ projectId })
                .filter((row) => row.changeStatus !== "unchanged")
                .toArray();

            // Nếu không có gì thay đổi thì vẫn tạo version rỗng (đánh dấu mốc thời gian)
            if (changedRows.length === 0) return versionId;

            // 3. Tiến hành "Chốt đơn" (Reset State)
            const updatedRows = changedRows.map((row) => ({
                ...row,
                // Chép đè toàn bộ bản dịch hiện tại vào thành bản Gốc
                originalValues: { ...row.values },
                // Trả trạng thái về bình thường
                changeStatus: "unchanged" as const,
                // Xóa meta data của Cell (nếu sau này Phase 2 có dùng)
                cellMeta: {},
                updatedAt: now,
            }));

            // 4. Bulk Write: Đổ ngược lại vào IndexedDB siêu tốc
            await db.translationRows.bulkPut(updatedRows);

            return versionId;
        },
    );
};
