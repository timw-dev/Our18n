"use client";

import { create } from "zustand";
import { db } from "@/lib/db";

type RowChangeStatus = "unchanged" | "updated" | "added" | "deleted";

interface UndoCommand {
    type: "PASTE" | "EDIT";
    // Cấu trúc: Record<rowId, Record<langCode, value_truoc_khi_thao_tac>>
    beforeValues: Record<string, Record<string, string>>;
}

interface RedoCommand {
    type: "PASTE" | "EDIT";
    // Cấu trúc: Record<rowId, Record<langCode, value_sau_khi_thao_tac_nhung_bi_undo>>
    afterValues: Record<string, Record<string, string>>;
}

interface UndoStore {
    undoStack: UndoCommand[];
    redoStack: RedoCommand[];
    pushToUndo: (command: UndoCommand) => void;
    performUndo: () => Promise<boolean>;
    performRedo: () => Promise<boolean>;
    clearUndo: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
    undoStack: [],
    redoStack: [],

    pushToUndo: (command) => {
        set((state) => ({
            undoStack: [...state.undoStack.slice(-29), command],
            redoStack: [], // Khi có hành động sửa đổi mới, reset sạch hàng đợi Redo cũ theo chuẩn Spreadsheet
        }));
    },

    performUndo: async () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return false;

        const lastCommand = undoStack[undoStack.length - 1];
        const currentValuesForRedo: Record<string, Record<string, string>> = {};

        // FIX LỖI: Sửa từ db.transactionRows thành db.translationRows chuẩn chỉ
        await db.transaction("rw", db.translationRows, async () => {
            for (const [rowId, oldValues] of Object.entries(
                lastCommand.beforeValues,
            )) {
                const currentRow = await db.translationRows.get(rowId);
                if (currentRow) {
                    // Thu thập lại data hiện tại trước khi bị đè ngược bởi Undo để phục vụ Redo
                    currentValuesForRedo[rowId] = {};
                    Object.keys(oldValues).forEach((lang) => {
                        currentValuesForRedo[rowId][lang] =
                            currentRow.values[lang] || "";
                    });

                    // Tiến hành khôi phục dữ liệu cũ
                    const newValues = { ...currentRow.values, ...oldValues };

                    // Xóa hẳn key rỗng ra khỏi database nếu dữ liệu undo về trạng thái chưa từng tồn tại
                    Object.keys(newValues).forEach((key) => {
                        if (
                            newValues[key] === undefined ||
                            newValues[key] === null ||
                            newValues[key] === ""
                        ) {
                            delete newValues[key];
                        }
                    });

                    const isUnchanged =
                        JSON.stringify(newValues) ===
                        JSON.stringify(currentRow.originalValues);
                    const finalStatus: RowChangeStatus = isUnchanged
                        ? "unchanged"
                        : "updated";

                    await db.translationRows.update(rowId, {
                        values: newValues,
                        changeStatus: finalStatus,
                    });
                }
            }
        });

        set((state) => ({
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [
                ...state.redoStack,
                { type: lastCommand.type, afterValues: currentValuesForRedo },
            ],
        }));

        return true;
    },

    performRedo: async () => {
        const { redoStack } = get();
        if (redoStack.length === 0) return false;

        const lastRedoCommand = redoStack[redoStack.length - 1];
        const beforeValuesForUndo: Record<string, Record<string, string>> = {};

        // FIX LỖI: Đồng bộ chính xác tên bảng db.translationRows
        await db.transaction("rw", db.translationRows, async () => {
            for (const [rowId, futureValues] of Object.entries(
                lastRedoCommand.afterValues,
            )) {
                const currentRow = await db.translationRows.get(rowId);
                if (currentRow) {
                    // Lưu lại data trước khi Redo đề phòng user lại muốn Undo tiếp
                    beforeValuesForUndo[rowId] = {};
                    Object.keys(futureValues).forEach((lang) => {
                        beforeValuesForUndo[rowId][lang] =
                            currentRow.values[lang] || "";
                    });

                    // Nạp đè giá trị tương lai vào lại mạng lưới dữ liệu
                    const newValues = { ...currentRow.values, ...futureValues };

                    Object.keys(newValues).forEach((key) => {
                        if (
                            newValues[key] === undefined ||
                            newValues[key] === null ||
                            newValues[key] === ""
                        ) {
                            delete newValues[key];
                        }
                    });

                    const isUnchanged =
                        JSON.stringify(newValues) ===
                        JSON.stringify(currentRow.originalValues);
                    const finalStatus: RowChangeStatus = isUnchanged
                        ? "unchanged"
                        : "updated";

                    await db.translationRows.update(rowId, {
                        values: newValues,
                        changeStatus: finalStatus,
                    });
                }
            }
        });

        set((state) => ({
            redoStack: state.redoStack.slice(0, -1),
            undoStack: [
                ...state.undoStack,
                {
                    type: lastRedoCommand.type,
                    beforeValues: beforeValuesForUndo,
                },
            ],
        }));

        return true;
    },

    clearUndo: () => set({ undoStack: [], redoStack: [] }),
}));
