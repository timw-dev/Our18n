"use client";

import { create } from "zustand";

export interface CellCoordinate {
    rowIdx: number;
    colIdx: number; // 0: cột đầu tiên (ví dụ: en), 1: cột tiếp theo (vi),...
}

interface SpreadsheetStore {
    selectedRange: { start: CellCoordinate; end: CellCoordinate } | null;
    editingCell: CellCoordinate | null;

    setSelectedRange: (
        range: { start: CellCoordinate; end: CellCoordinate } | null,
    ) => void;
    setEditingCell: (cell: CellCoordinate | null) => void;
    clearSelection: () => void;
}

export const useSpreadsheetStore = create<SpreadsheetStore>((set) => ({
    selectedRange: null,
    editingCell: null,

    setSelectedRange: (range) => set({ selectedRange: range }),
    setEditingCell: (cell) => set({ editingCell: cell }),
    clearSelection: () => set({ selectedRange: null, editingCell: null }),
}));
