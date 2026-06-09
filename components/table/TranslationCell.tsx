"use client";

import { useEffect, useState, useRef, memo, useMemo } from "react";
import { updateTranslationCell, type TranslationRow } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";
import { useUndoStore } from "@/app/store/useUndoStore";
import { cn } from "@/lib/utils";

interface TranslationCellProps {
    row: TranslationRow;
    langCode: string;
    rowIdx: number;
    colIdx: number;
}

export const TranslationCell = memo(({ row, langCode, rowIdx, colIdx }: TranslationCellProps) => {
    const dbValue = row.values[langCode] || "";
    const originalValue = row.originalValues?.[langCode] || "";

    const [value, setValue] = useState(dbValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { selectedRange, editingCell, setSelectedRange, setEditingCell } = useSpreadsheetStore();
    const pushToUndo = useUndoStore((state) => state.pushToUndo);

    useEffect(() => {
        setValue(dbValue);
    }, [dbValue]);

    const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colIdx === colIdx;

    const isSelected = useMemo(() => {
        if (!selectedRange) return false;
        const minRow = Math.min(selectedRange.start.rowIdx, selectedRange.end.rowIdx);
        const maxRow = Math.max(selectedRange.start.rowIdx, selectedRange.end.rowIdx);
        const minCol = Math.min(selectedRange.start.colIdx, selectedRange.end.colIdx);
        const maxCol = Math.max(selectedRange.start.colIdx, selectedRange.end.colIdx);

        return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
    }, [selectedRange, rowIdx, colIdx]);

    const isAnchor = useMemo(() => {
        if (!selectedRange) return false;
        return selectedRange.start.rowIdx === rowIdx && selectedRange.start.colIdx === colIdx;
    }, [selectedRange, rowIdx, colIdx]);

    // Tự động focus sâu và tính toán độ giãn chiều cao khi bật Edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    const handleBlur = async () => {
        setEditingCell(null);
        const sanitizedValue = value.trim();
        if (sanitizedValue === dbValue) return;

        try {
            pushToUndo({
                type: "EDIT",
                beforeValues: { [row.id]: { [langCode]: dbValue } }
            });

            await updateTranslationCell(row.id, langCode, sanitizedValue);
            useAppStore.getState().setActiveVersion(null);
        } catch (error) {
            console.error("Lỗi khi auto-save:", error);
        }
    };

    // Đón chặn click chuột trái để quét khối dải ô Excel, ngăn chặn lem màu xanh chữ native
    const handleCellMouseDown = (e: React.MouseEvent) => {
        if (isEditing) return;
        e.preventDefault();

        const currentCoord = { rowIdx, colIdx };

        if (e.shiftKey && selectedRange) {
            setSelectedRange({ start: selectedRange.start, end: currentCoord });
        } else {
            if (isAnchor && !isEditing) {
                setEditingCell(currentCoord);
            } else {
                setSelectedRange({ start: currentCoord, end: currentCoord });
            }
        }
    };

    const isChanged = dbValue !== originalValue;
    const isMissing = !value.trim();

    return (
        <div
            onMouseDown={handleCellMouseDown}
            className={cn(
                "relative w-full h-full flex items-stretch select-none transition-all min-w-[250px] border border-transparent outline-none bg-inherit",
                isSelected && "bg-blue-500/[0.06] dark:bg-blue-500/10",
                isAnchor && "ring-2 ring-blue-600 ring-inset z-20 shadow-sm rounded-sm",
                isSelected && !isAnchor && "ring-2 ring-blue-600/60 ring-inset z-10"
            )}
        >
            {/* FIX: Thêm pointer-events-none và hạ z-index xuống 10 */}
            {isChanged && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-10 pointer-events-none" />}
            {isMissing && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 z-10 pointer-events-none" />}

            {!isEditing ? (
                <div className="w-full py-3 pr-3 pl-4 font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap break-word overflow-wrap-anywhere overflow-hidden cursor-cell select-none">
                    {value || <span className="text-muted-foreground/30 italic">...</span>}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Nhập bản dịch..."
                    rows={1}
                    className="w-full bg-background resize-none py-3 pr-3 pl-4 rounded-none border border-transparent transition-all outline-none cursor-text font-sans text-sm text-foreground leading-relaxed z-40 shadow-inner"
                    style={{ height: "auto" }}
                />
            )
            }
        </div >
    );
});

TranslationCell.displayName = "TranslationCell";