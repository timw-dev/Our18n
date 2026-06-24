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
import { db, updateTranslationCell } from "@/lib/db";

import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTableSpreadsheetCopyPaste } from "@/hooks/useTableSpreadsheetCopyPaste";
import { TranslationToolbar } from "./TranslationToolbar";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { cn } from "@/lib/utils";

export default function TranslationTable() {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const { activeProjectId } = useAppStore();

    const { selectedRange, editSession, setSelectedRange, beginEditing, cancelEditing } = useSpreadsheetStore();
    const isInteractionLocked = useSpreadsheetStore((state) => Object.keys(state.interactionLocks).length > 0);
    const { performUndo, performRedo, pushToUndo } = useUndoStore();

    const project = useLiveQuery(() => activeProjectId ? db.projects.get(activeProjectId) : undefined, [activeProjectId]);
    const rawRows = useLiveQuery(() => activeProjectId ? db.translationRows.where({ projectId: activeProjectId }).toArray() : [], [activeProjectId]);
    const namespaces = useLiveQuery(() => activeProjectId ? db.namespaces.where({ projectId: activeProjectId }).toArray() : [], [activeProjectId]);

    const data = useMemo(() => rawRows || [], [rawRows]);
    const columns = useTranslationColumns(project, namespaces || []);

    const table = useTranslationTable(data, columns);

    const isVisibilityRestored = useRef(false);

    useEffect(() => {
        if (activeProjectId && project && !isVisibilityRestored.current) {
            const savedVis = localStorage.getItem(`our18n_vis_${activeProjectId}`);
            if (savedVis) {
                try {
                    table.setColumnVisibility(JSON.parse(savedVis));
                } catch (e) {
                    console.error("Lỗi parse visibility state");
                }
            }
            isVisibilityRestored.current = true;
        }
    }, [activeProjectId, project, table]);

    useEffect(() => {
        if (isVisibilityRestored.current && activeProjectId) {
            const currentVis = table.getState().columnVisibility;
            localStorage.setItem(`our18n_vis_${activeProjectId}`, JSON.stringify(currentVis));
        }
    }, [table.getState().columnVisibility, activeProjectId]);

    useEffect(() => {
        isVisibilityRestored.current = false;
    }, [activeProjectId]);

    const { handlePaste, handleCopy } = useTableSpreadsheetCopyPaste({
        table,
    });

    useEffect(() => {
        const activeElem = document.activeElement;
        const isUserEditing = activeElem?.tagName === "TEXTAREA" && !activeElem.hasAttribute("readOnly");

        // CHỈ FOCUS vào hidden input ẩn của bảng nếu user KHÔNG ĐANG focus vào toolbar chỉnh sửa
        if (!isInteractionLocked && selectedRange && !editSession && !isUserEditing && activeElem?.tagName !== "INPUT" && hiddenInputRef.current) {
            hiddenInputRef.current.focus();
        }
    }, [selectedRange, editSession, isInteractionLocked]);

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
            if (isInteractionLocked) return;
            const activeElem = document.activeElement;

            // ==========================================
            // FIX CHÍ MẠNG: CHẶN TUYỆT ĐỐI CƯỚP FOCUS KHI ĐANG GÕ Ô SEARCH HOẶC INPUT KHÁC
            // ==========================================
            if (
                activeElem?.tagName === "INPUT" ||
                activeElem?.tagName === "TEXTAREA" && activeElem !== hiddenInputRef.current ||
                activeElem?.hasAttribute("contenteditable")
            ) {
                return; // Trả lại toàn bộ quyền gõ phím chuẩn cho trình duyệt, không can thiệp logic bảng
            }

            const key = e.key;
            const isCtrlOrMeta = e.ctrlKey || e.metaKey;

            // Phím tắt Undo/Redo
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
            const tableRows = table.getFilteredRowModel().rows;
            const currentAnchor = selectedRange.start;
            const currentRowIdx = tableRows.findIndex(row => row.original.id === currentAnchor.rowId);
            const currentRowData = tableRows[currentRowIdx]?.original;
            if (!currentRowData) return;

            // QUẢN LÝ DANH SÁCH CỘT ĐANG HIỆN THỰC TẾ (SKIP HIDDEN COLUMNS)
            const allLeafCols = table.getAllLeafColumns();
            const visibleLangCols = allLeafCols.filter(col => col.id.startsWith("lang_") && col.getIsVisible());
            const totalVisibleCols = visibleLangCols.length;

            if (totalVisibleCols === 0) return;

            const currentLangCode = currentAnchor.langCode;
            const currentVisibleColIdx = visibleLangCols.findIndex(col => col.id === `lang_${currentLangCode}`);
            if (currentVisibleColIdx < 0) return;

            const moveToCell = (rowIdx: number, visibleColIdx: number) => {
                const targetRow = tableRows[rowIdx]?.original;
                const targetColumn = visibleLangCols[visibleColIdx];
                if (!targetRow || !targetColumn) return;
                const target = { rowId: targetRow.id, langCode: targetColumn.id.replace("lang_", "") };
                setSelectedRange({ start: target, end: target });
            };

            // ==========================================
            // CHỐT MỤC HỦY BỎ: NÚT BACK CHO TEXT KHI ĐANG SỬA Ô (PHÍM ESCAPE)
            // ==========================================
            if (key === "Escape") {
                e.preventDefault();
                if (editSession) {
                    cancelEditing();
                    toast.info("Đã hủy bỏ sửa đổi ô.");
                    if (hiddenInputRef.current) hiddenInputRef.current.focus();
                }
                return;
            }

            // MỤC 4 - ENTER / F2 BEHAVIOR
            if (key === "Enter") {
                e.preventDefault();
                beginEditing(currentAnchor, currentRowData.values[currentLangCode] || "");
                return;
            }

            if (key === "F2") {
                e.preventDefault();
                beginEditing(currentAnchor, currentRowData.values[currentLangCode] || "");
                return;
            }

            // MỤC 3 - TAB WRAP INSIDE GRID
            if (key === "Tab") {
                e.preventDefault();

                if (e.shiftKey) {
                    if (currentVisibleColIdx > 0) {
                        moveToCell(currentRowIdx, currentVisibleColIdx - 1);
                    } else if (currentRowIdx > 0) {
                        moveToCell(currentRowIdx - 1, totalVisibleCols - 1);
                    }
                } else {
                    if (currentVisibleColIdx < totalVisibleCols - 1) {
                        moveToCell(currentRowIdx, currentVisibleColIdx + 1);
                    } else if (currentRowIdx < tableRows.length - 1) {
                        moveToCell(currentRowIdx + 1, 0);
                    }
                }
                return;
            }

            // MỤC 2 - MŨI TÊN CHỈ ĐI QUA CỘT ĐANG HIỆN
            if (key === "ArrowRight") {
                e.preventDefault();
                const nextVisibleIdx = Math.min(totalVisibleCols - 1, currentVisibleColIdx + 1);
                moveToCell(currentRowIdx, nextVisibleIdx);
            }
            if (key === "ArrowLeft") {
                e.preventDefault();
                const prevVisibleIdx = Math.max(0, currentVisibleColIdx - 1);
                moveToCell(currentRowIdx, prevVisibleIdx);
            }
            if (key === "ArrowDown") {
                e.preventDefault();
                const nextRowIdx = Math.min(tableRows.length - 1, currentRowIdx + 1);
                moveToCell(nextRowIdx, currentVisibleColIdx);
            }
            if (key === "ArrowUp") {
                e.preventDefault();
                const prevRowIdx = Math.max(0, currentRowIdx - 1);
                moveToCell(prevRowIdx, currentVisibleColIdx);
            }

            if (key === "Delete" || key === "Backspace") {
                const dbValue = currentRowData.values[currentLangCode] || "";
                if (!dbValue) return;

                e.preventDefault();
                pushToUndo({
                    type: "EDIT",
                    beforeValues: { [currentRowData.id]: { [currentLangCode]: dbValue } }
                });

                await updateTranslationCell(currentRowData.id, currentLangCode, "");
                useAppStore.getState().setActiveVersion(null);
                return;
            }

            if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                const dbValue = currentRowData.values[currentLangCode] || "";

                beginEditing(currentAnchor, dbValue, key);
            }
        };

        window.addEventListener("keydown", handleKeyDownGlobal);
        return () => window.removeEventListener("keydown", handleKeyDownGlobal);
    }, [selectedRange,
        table,
        performUndo,
        performRedo,
        pushToUndo,
        beginEditing,
        cancelEditing,
        setSelectedRange,
        editSession
        , isInteractionLocked
    ]);

    useEffect(() => {
        const handleNavigate = (event: Event) => {
            if (isInteractionLocked) return;
            if (!selectedRange) return;
            const direction = (event as CustomEvent<{ direction: "next" | "previous" | "down" }>).detail.direction;
            const tableRows = table.getFilteredRowModel().rows;
            const visibleLangCols = table.getAllLeafColumns().filter(col => col.id.startsWith("lang_") && col.getIsVisible());
            const rowIdx = tableRows.findIndex(row => row.original.id === selectedRange.start.rowId);
            const colIdx = visibleLangCols.findIndex(col => col.id === `lang_${selectedRange.start.langCode}`);
            if (rowIdx < 0 || colIdx < 0) return;

            let nextRow = rowIdx;
            let nextCol = colIdx;
            if (direction === "down") nextRow = Math.min(tableRows.length - 1, rowIdx + 1);
            if (direction === "next") {
                if (colIdx < visibleLangCols.length - 1) nextCol += 1;
                else if (rowIdx < tableRows.length - 1) { nextRow += 1; nextCol = 0; }
            }
            if (direction === "previous") {
                if (colIdx > 0) nextCol -= 1;
                else if (rowIdx > 0) { nextRow -= 1; nextCol = visibleLangCols.length - 1; }
            }

            const targetRow = tableRows[nextRow]?.original;
            const targetCol = visibleLangCols[nextCol];
            if (!targetRow || !targetCol) return;
            const target = { rowId: targetRow.id, langCode: targetCol.id.replace("lang_", "") };
            setSelectedRange({ start: target, end: target });
        };
        window.addEventListener("our18n:navigate-cell", handleNavigate);
        return () => window.removeEventListener("our18n:navigate-cell", handleNavigate);
    }, [isInteractionLocked, selectedRange, setSelectedRange, table]);

    const langColWidth = useMemo(() => {
        if (!table) return 300;
        const visibleLangCount = table.getAllLeafColumns().filter(col => col.id.startsWith("lang_") && col.getIsVisible()).length;
        if (visibleLangCount <= 2) return 450;
        return 320;
    }, [table, project]);

    if (!activeProjectId || !project) {
        return <div className="p-10 text-center text-muted-foreground">Vui lòng chọn Project.</div>;
    }

    return (
        <div className="w-full h-full flex flex-col min-h-0 space-y-4">
            <textarea
                ref={hiddenInputRef}
                className="sr-only absolute w-0 h-0 opacity-0 pointer-events-none"
                tabIndex={-1}
                onPaste={(e) => {
                    handlePaste(e.nativeEvent);
                }}
            />

            <div className="shrink-0 z-40 bg-background pb-1">
                <TranslationToolbar table={table} totalRows={data.length} />
            </div>

            <div
                ref={tableContainerRef}
                className="flex-1 relative border rounded-md shadow-sm bg-background w-full overflow-auto outline-none [&>div]:overflow-visible"
            >
                {/* SỬA: Thêm class [&_td:nth-last-child(3)]:border-r-0 để triệt tiêu đường viền thừa tiếp giáp với cột Sticky, triệt hạ 100% vệt hở line */}
                <Table className="table-fixed min-w-full w-full border-collapse [&_td:nth-last-child(3)]:border-r-0 [&_th:nth-last-child(3)]:border-r-0">
                    <TableHeader className="sticky top-0 bg-background z-50 shadow-sm border-b ring-1 ring-border">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
                                {headerGroup.headers.map((header) => {
                                    const isActions = header.id === "actions";
                                    const isStatus = header.id === "status";
                                    const isSticky = isActions || isStatus;
                                    const isLangCol = header.id.startsWith("lang_");

                                    return (
                                        <TableHead
                                            key={header.id}
                                            style={{
                                                width: isLangCol ? langColWidth : header.getSize(),
                                                right: isActions ? 0 : isStatus ? 60 : undefined
                                            }}
                                            className={cn(
                                                "border-r last:border-r-0 font-extrabold uppercase text-[11px] text-foreground/80 tracking-wider h-10 px-2 align-middle bg-muted select-none",
                                                isActions && "sticky right-0 z-60 bg-muted border-l shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]",
                                                isStatus && "sticky z-60 bg-muted border-l shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.2)]"
                                            )}
                                        >
                                            {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <VirtualizedTableBody table={table} scrollRef={tableContainerRef} />
                </Table>
            </div>
        </div>
    );
}
