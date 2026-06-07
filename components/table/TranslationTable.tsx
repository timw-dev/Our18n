"use client";

import { flexRender } from "@tanstack/react-table";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { useAppStore } from "@/app/store/useAppStore";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";
import { useUndoStore } from "@/app/store/useUndoStore";
import { useTranslationColumns } from "@/hooks/useTranslationColumns";
import { useTranslationTable } from "@/hooks/useTranslationTable";
import { db } from "@/lib/db";

import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSpreadsheetCopyPaste } from "@/hooks/useTableSpreadsheetCopyPaste";
import { TranslationToolbar } from "./TranslationToolbar";
import { VirtualizedTableBody } from "./VirtualizedTableBody";

export default function TranslationTable() {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const { activeProjectId } = useAppStore();

    const { selectedRange, editingCell, setSelectedRange, setEditingCell } = useSpreadsheetStore();
    const { performUndo, performRedo, pushToUndo } = useUndoStore();

    // 1. Data Fetching từ Dexie - useLiveQuery sẽ tự động render lại UI khi có bất kỳ thay đổi nào từ DB
    const project = useLiveQuery(() => activeProjectId ? db.projects.get(activeProjectId) : undefined, [activeProjectId]);
    const rawRows = useLiveQuery(() => activeProjectId ? db.translationRows.where({ projectId: activeProjectId }).toArray() : [], [activeProjectId]);
    const namespaces = useLiveQuery(() => activeProjectId ? db.namespaces.where({ projectId: activeProjectId }).toArray() : [], [activeProjectId]);

    const data = useMemo(() => rawRows || [], [rawRows]);
    const columns = useTranslationColumns(project, namespaces || []);

    // ĐÃ SỬA: Đưa về đúng 2 tham số nguyên bản để khớp với hook
    const table = useTranslationTable(data, columns);

    const totalCols = useMemo(() => project?.languages.length || 0, [project]);
    const visibleLanguages = useMemo(() => project?.languages || [], [project]);

    const { handlePaste, handleCopy } = useTableSpreadsheetCopyPaste({
        table,
        projectId: activeProjectId || "",
        visibleLanguages,
    });

    useEffect(() => {
        const activeElem = document.activeElement;
        const isUserEditing = activeElem?.tagName === "TEXTAREA" && !activeElem.hasAttribute("readOnly");

        if (selectedRange && !editingCell && !isUserEditing && hiddenInputRef.current) {
            hiddenInputRef.current.focus();
        }
    }, [selectedRange, editingCell]);

    useEffect(() => {
        window.addEventListener("paste", handlePaste);
        window.addEventListener("copy", handleCopy);
        return () => {
            window.removeEventListener("paste", handlePaste);
            window.removeEventListener("copy", handleCopy);
        };
    }, [handlePaste, handleCopy]);

    useEffect(() => {
        const handleKeyDownGlobal = async (e: KeyboardEvent) => {
            const activeElem = document.activeElement;
            if (activeElem?.tagName === "TEXTAREA" && activeElem !== hiddenInputRef.current) {
                return;
            }

            const key = e.key;
            const isCtrlOrMeta = e.ctrlKey || e.metaKey;

            const isRedoShortcut = (isCtrlOrMeta && key.toLowerCase() === "y") || (isCtrlOrMeta && e.shiftKey && key.toLowerCase() === "z");
            if (isRedoShortcut) {
                e.preventDefault();
                if (await performRedo()) toast.success("Redo thành công!");
                return;
            }

            if (isCtrlOrMeta && key.toLowerCase() === "z" && !e.shiftKey) {
                e.preventDefault();
                if (await performUndo()) toast.success("Undo thành công!");
                return;
            }

            if (!selectedRange) return;
            const currentAnchor = selectedRange.start;

            const tableRows = table.getFilteredRowModel().rows;
            const currentRowData = tableRows[currentAnchor.rowIdx]?.original;
            if (!currentRowData) return;

            const currentLangCode = visibleLanguages[currentAnchor.colIdx];

            if (key === "Enter") {
                e.preventDefault();
                setEditingCell(currentAnchor);
                return;
            }

            if (key === "Tab") {
                if (e.shiftKey) {
                    if (currentAnchor.colIdx > 0) {
                        e.preventDefault();
                        const prevCell = { rowIdx: currentAnchor.rowIdx, colIdx: currentAnchor.colIdx - 1 };
                        setSelectedRange({ start: prevCell, end: prevCell });
                    }
                } else {
                    if (currentAnchor.colIdx < totalCols - 1) {
                        e.preventDefault();
                        const nextCell = { rowIdx: currentAnchor.rowIdx, colIdx: currentAnchor.colIdx + 1 };
                        setSelectedRange({ start: nextCell, end: nextCell });
                    }
                }
                return;
            }

            if (key === "ArrowRight") {
                e.preventDefault();
                const target = { rowIdx: currentAnchor.rowIdx, colIdx: Math.min(totalCols - 1, currentAnchor.colIdx + 1) };
                setSelectedRange({ start: target, end: target });
            }
            if (key === "ArrowLeft") {
                e.preventDefault();
                const target = { rowIdx: currentAnchor.rowIdx, colIdx: Math.max(0, currentAnchor.colIdx - 1) };
                setSelectedRange({ start: target, end: target });
            }
            if (key === "ArrowDown") {
                e.preventDefault();
                const target = { rowIdx: Math.min(tableRows.length - 1, currentAnchor.rowIdx + 1), colIdx: currentAnchor.colIdx };
                setSelectedRange({ start: target, end: target });
            }
            if (key === "ArrowUp") {
                e.preventDefault();
                const target = { rowIdx: Math.max(0, currentAnchor.rowIdx - 1), colIdx: currentAnchor.colIdx };
                setSelectedRange({ start: target, end: target });
            }

            if (key === "Delete" || key === "Backspace") {
                const dbValue = currentRowData.values[currentLangCode] || "";
                if (!dbValue) return;

                e.preventDefault();
                pushToUndo({
                    type: "EDIT",
                    beforeValues: { [currentRowData.id]: { [currentLangCode]: dbValue } }
                });

                const updatedValues = { ...currentRowData.values };
                delete updatedValues[currentLangCode];

                const isUnchanged = JSON.stringify(updatedValues) === JSON.stringify(currentRowData.originalValues);
                await db.translationRows.update(currentRowData.id, {
                    values: updatedValues,
                    changeStatus: isUnchanged ? "unchanged" : "updated"
                });
                useAppStore.getState().setActiveVersion(null);
                return;
            }

            if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                const dbValue = currentRowData.values[currentLangCode] || "";

                pushToUndo({
                    type: "EDIT",
                    beforeValues: { [currentRowData.id]: { [currentLangCode]: dbValue } }
                });

                setEditingCell(currentAnchor);

                setTimeout(() => {
                    const txtArea = document.querySelector("td textarea") as HTMLTextAreaElement;
                    if (txtArea) {
                        txtArea.value = key;
                        txtArea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 30);
            }
        };

        window.addEventListener("keydown", handleKeyDownGlobal);
        return () => window.removeEventListener("keydown", handleKeyDownGlobal);
    }, [selectedRange, totalCols, visibleLanguages, table, performUndo, performRedo, pushToUndo, setEditingCell, setSelectedRange]);

    if (!activeProjectId || !project) {
        return <div className="p-10 text-center text-muted-foreground">Vui lòng chọn Project.</div>;
    }

    return (
        <div className="w-full space-y-4">
            <textarea
                ref={hiddenInputRef}
                className="sr-only absolute w-0 h-0 opacity-0 pointer-events-none"
                tabIndex={-1}
                onPaste={(e) => {
                    handlePaste(e.nativeEvent);
                }}
            />

            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 pb-2 pt-2">
                <TranslationToolbar table={table} totalRows={data.length} />
            </div>

            <div
                ref={tableContainerRef}
                className="border rounded-md shadow-sm bg-background w-full overflow-auto max-h-[calc(100vh-280px)] outline-none"
            >
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-muted/50">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="border-r last:border-r-0 font-bold uppercase text-xs">
                                        {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <VirtualizedTableBody table={table} scrollRef={tableContainerRef} />
                </Table>
            </div>
        </div>
    );
}