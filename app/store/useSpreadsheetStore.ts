"use client";

import { create } from "zustand";
import { updateTranslationCell } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { useUndoStore } from "@/app/store/useUndoStore";

export interface CellCoordinate {
    rowId: string;
    langCode: string;
}

interface EditSession extends CellCoordinate {
    baseValue: string;
    draftValue: string;
    status: "editing" | "saving" | "error";
    error?: string;
}

interface SpreadsheetState {
    selectedRange: { start: CellCoordinate; end: CellCoordinate } | null;
    editSession: EditSession | null;
    interactionLocks: Record<string, boolean>;

    setSelectedRange: (
        range: { start: CellCoordinate; end: CellCoordinate } | null,
    ) => void;
    beginEditing: (cell: CellCoordinate, value: string, initialValue?: string) => void;
    setDraftValue: (value: string) => void;
    cancelEditing: () => void;
    commitActiveEdit: () => Promise<boolean>;
    setInteractionLock: (key: string, locked: boolean) => void;
    clearSelection: () => void;
}

let pendingCommit: Promise<boolean> | null = null;

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
    selectedRange: null,
    editSession: null,
    interactionLocks: {},

    setSelectedRange: (range) => set({ selectedRange: range }),

    beginEditing: (cell, value, initialValue) => set({
        editSession: {
            ...cell,
            baseValue: value,
            draftValue: initialValue ?? value,
            status: "editing",
        },
    }),

    setDraftValue: (draftValue) => set((state) => state.editSession ? {
        editSession: { ...state.editSession, draftValue, status: "editing", error: undefined },
    } : state),

    cancelEditing: () => set({ editSession: null }),

    commitActiveEdit: async () => {
        if (pendingCommit) return pendingCommit;

        const session = get().editSession;
        if (!session) return true;
        if (session.draftValue === session.baseValue) {
            set({ editSession: null });
            return true;
        }

        pendingCommit = (async () => {
            set((state) => state.editSession ? {
                editSession: { ...state.editSession, status: "saving", error: undefined },
            } : state);

            try {
                await updateTranslationCell(session.rowId, session.langCode, session.draftValue);
                useUndoStore.getState().pushToUndo({
                    type: "EDIT",
                    beforeValues: { [session.rowId]: { [session.langCode]: session.baseValue } },
                });
                useAppStore.getState().setActiveVersion(null);
                set((state) => {
                    const current = state.editSession;
                    if (!current || current.rowId !== session.rowId || current.langCode !== session.langCode) {
                        return state;
                    }
                    return { editSession: null };
                });
                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Không thể lưu thay đổi";
                set((state) => state.editSession ? {
                    editSession: { ...state.editSession, status: "error", error: message },
                } : state);
                return false;
            } finally {
                pendingCommit = null;
            }
        })();

        return pendingCommit;
    },

    setInteractionLock: (key, locked) => set((state) => {
        const interactionLocks = { ...state.interactionLocks };
        if (locked) interactionLocks[key] = true;
        else delete interactionLocks[key];
        return { interactionLocks };
    }),

    clearSelection: () => set({ selectedRange: null, editSession: null }),
}));
