"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { db, type TranslationRow } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";
import { useUndoStore } from "@/app/store/useUndoStore";
import { type Table as TanStackTable } from "@tanstack/react-table";

interface UseSpreadsheetCopyPasteProps<TData> {
    table: TanStackTable<TData>;
}

export function useTableSpreadsheetCopyPaste<
    TData extends {
        id: string;
        namespaceId: string;
        key: string;
        values: Record<string, string>;
        changeStatus: string;
    },
>({ table }: UseSpreadsheetCopyPasteProps<TData>) {
    const { selectedRange } = useSpreadsheetStore();

    const handlePaste = useCallback(
        async (event: ClipboardEvent) => {
            if (Object.keys(useSpreadsheetStore.getState().interactionLocks).length > 0) return;
            const target = event.target as HTMLElement;

            // CẬP NHẬT RÀO CHẮN AN TOÀN:
            // Chỉ chặn paste nếu người dùng đang thực sự chỉnh sửa gõ chữ trong TEXTAREA con của các ô dịch.
            // Nếu target là Textarea tàng hình (có class sr-only) ở tầng cha thì VẪN CHO PHÉP PASTE.
            if (
                target.tagName === "INPUT" ||
                (target.tagName === "TEXTAREA" &&
                    !target.classList.contains("sr-only"))
            ) {
                return;
            }

            const clipboardData = event.clipboardData?.getData("text/plain");
            if (!clipboardData) return;

            event.preventDefault();

            const rows = clipboardData
                .split(/\r?\n/)
                .filter((line) => line.length > 0);
            const parsedMatrix = rows.map((row) => row.split("\t"));

            const tableRows = table.getFilteredRowModel().rows;
            const activeLanguages = table.getAllLeafColumns()
                .filter(column => column.id.startsWith("lang_") && column.getIsVisible())
                .map(column => column.id.replace("lang_", ""));
            if (tableRows.length === 0) return;

            // Lấy điểm đích bắt đầu dán dựa vào ô đang được active (Anchor), nếu không có thì mặc định là ô [0,0]
            const selectedStartRow = selectedRange ? tableRows.findIndex(row => row.original.id === selectedRange.start.rowId) : 0;
            const selectedEndRow = selectedRange ? tableRows.findIndex(row => row.original.id === selectedRange.end.rowId) : 0;
            const selectedStartCol = selectedRange ? activeLanguages.indexOf(selectedRange.start.langCode) : 0;
            const selectedEndCol = selectedRange ? activeLanguages.indexOf(selectedRange.end.langCode) : 0;
            const startRowIdx = selectedRange ? Math.min(selectedStartRow, selectedEndRow) : 0;
            const startColIdx = selectedRange ? Math.min(selectedStartCol, selectedEndCol) : 0;
            if (startRowIdx < 0 || startColIdx < 0) return;

            let cellsUpdatedCount = 0;
            const rowsToUpdateMap = new Map<string, TranslationRow>();

            // Khởi tạo Object cấu trúc nghiêm ngặt để lưu trạng thái trước khi paste nhằm phục vụ Undo
            const beforeValuesForUndo: Record<
                string,
                Record<string, string>
            > = {};

            parsedMatrix.forEach((matrixRow, rOffset) => {
                const targetRowIdx = startRowIdx + rOffset;
                if (targetRowIdx >= tableRows.length) return;

                const tableRowData = tableRows[targetRowIdx]
                    .original as unknown as TranslationRow;

                if (!rowsToUpdateMap.has(tableRowData.id)) {
                    rowsToUpdateMap.set(tableRowData.id, {
                        ...tableRowData,
                        values: { ...tableRowData.values },
                    });
                }

                const currentRowUpdate = rowsToUpdateMap.get(tableRowData.id);
                if (!currentRowUpdate) return;

                matrixRow.forEach((cellValue, cOffset) => {
                    const targetColIdx = startColIdx + cOffset;
                    if (targetColIdx >= activeLanguages.length) return;

                    const targetLang = activeLanguages[targetColIdx];
                    const sanitizedValue = cellValue;

                    if (
                        currentRowUpdate.values[targetLang] !== sanitizedValue
                    ) {
                        // Ghi nhận chính xác giá trị cũ của ô dịch trước khi bị ma trận mới đè lên
                        if (!beforeValuesForUndo[tableRowData.id]) {
                            beforeValuesForUndo[tableRowData.id] = {};
                        }
                        if (
                            beforeValuesForUndo[tableRowData.id][targetLang] ===
                            undefined
                        ) {
                            beforeValuesForUndo[tableRowData.id][targetLang] =
                                tableRowData.values[targetLang] || "";
                        }

                        currentRowUpdate.values[targetLang] = sanitizedValue;
                        currentRowUpdate.cellMeta = {
                            ...(currentRowUpdate.cellMeta ?? {}),
                            [targetLang]: {
                                ...(currentRowUpdate.cellMeta?.[targetLang] ?? {}),
                                changeStatus: sanitizedValue === (currentRowUpdate.originalValues[targetLang] || "") ? "unchanged" : "updated",
                                translationStatus: sanitizedValue.trim() ? "translated" : "missing",
                            },
                        };
                        cellsUpdatedCount++;
                    }
                });

                if (currentRowUpdate.changeStatus !== "added" && currentRowUpdate.changeStatus !== "deleted") {
                    const languages = new Set([...Object.keys(currentRowUpdate.values), ...Object.keys(currentRowUpdate.originalValues)]);
                    const hasChanges = Array.from(languages).some(lang =>
                        (currentRowUpdate.values[lang] || "") !== (currentRowUpdate.originalValues[lang] || "")
                    );
                    currentRowUpdate.changeStatus = hasChanges ? "updated" : "unchanged";
                }
            });

            if (cellsUpdatedCount === 0) return;

            // Đẩy khối dữ liệu cũ thu thập được vào Stack Hoàn tác (Undo) trước khi ghi đè DB
            useUndoStore.getState().pushToUndo({
                type: "PASTE",
                beforeValues: beforeValuesForUndo,
            });

            const toastId = toast.loading(
                "Đang xử lý dữ liệu paste hàng loạt...",
            );
            try {
                await db.transaction("rw", db.translationRows, async () => {
                    const updatePromises = Array.from(
                        rowsToUpdateMap.values(),
                    ).map((row) => db.translationRows.put(row));
                    await Promise.all(updatePromises);
                });

                useAppStore.getState().setActiveVersion?.(null);
                toast.success(
                    `Đã cập nhật thành công ${cellsUpdatedCount} ô dữ liệu!`,
                    { id: toastId },
                );
            } catch (error) {
                console.error("Paste Error:", error);
                toast.error("Lỗi khi update paste.", { id: toastId });
            }
        },
        [table, selectedRange],
    );

    // --- TASK 2: MULTI CELL COPY (TRÍCH XUẤT THEO RANGE KHỐI) ---
    // --- TRONG HÀM handleCopy CỦA FILE useTableSpreadsheetCopyPaste.ts ---
    const handleCopy = useCallback(
        (event: ClipboardEvent) => {
            if (Object.keys(useSpreadsheetStore.getState().interactionLocks).length > 0) return;
            const target = event.target as HTMLElement;

            // CHỈ CHẶN COPY NẾU USER ĐANG TRONG QUÁ TRÌNH GÕ CHỮ THỰC SỰ TRÊN CÁC Ô ĐANG CHỈNH SỬA
            if (
                target.tagName === "INPUT" ||
                (target.tagName === "TEXTAREA" &&
                    !target.classList.contains("sr-only"))
            ) {
                return;
            }

            event.preventDefault();

            // ... (Giữ nguyên toàn bộ khối logic tính toán ma trận tsvLines ở phía dưới) ...
            const tableRows = table.getFilteredRowModel().rows;
            const activeLanguages = table.getAllLeafColumns()
                .filter(column => column.id.startsWith("lang_") && column.getIsVisible())
                .map(column => column.id.replace("lang_", ""));
            if (tableRows.length === 0) return;

            let startRow = 0;
            let endRow = tableRows.length - 1;
            let startCol = 0;
            let endCol = activeLanguages.length - 1;

            if (selectedRange) {
                const startRowIndex = tableRows.findIndex(row => row.original.id === selectedRange.start.rowId);
                const endRowIndex = tableRows.findIndex(row => row.original.id === selectedRange.end.rowId);
                const startColumnIndex = activeLanguages.indexOf(selectedRange.start.langCode);
                const endColumnIndex = activeLanguages.indexOf(selectedRange.end.langCode);
                if ([startRowIndex, endRowIndex, startColumnIndex, endColumnIndex].some(index => index < 0)) return;
                startRow = Math.min(startRowIndex, endRowIndex);
                endRow = Math.max(startRowIndex, endRowIndex);
                startCol = Math.min(startColumnIndex, endColumnIndex);
                endCol = Math.max(startColumnIndex, endColumnIndex);
            }

            const tsvLines: string[] = [];
            for (let r = startRow; r <= endRow; r++) {
                const rowData = tableRows[r].original;
                const lineCells: string[] = [];
                for (let c = startCol; c <= endCol; c++) {
                    const lang = activeLanguages[c];
                    const val = rowData.values[lang] || "";
                    if (
                        val.includes("\n") ||
                        val.includes("\t") ||
                        val.includes('"')
                    ) {
                        lineCells.push(`"${val.replace(/"/g, '""')}"`);
                    } else {
                        lineCells.push(val);
                    }
                }
                tsvLines.push(lineCells.join("\t"));
            }

            const tsvString = tsvLines.join("\n");

            if (event.clipboardData) {
                event.clipboardData.setData("text/plain", tsvString);
                toast.success(
                    `Đã sao chép thành công vùng chọn (${endRow - startRow + 1} hàng x ${endCol - startCol + 1} cột).`,
                );
            }
        },
        [table, selectedRange],
    );

    return { handlePaste, handleCopy };
}
