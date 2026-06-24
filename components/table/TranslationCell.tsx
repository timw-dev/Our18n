"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { type TranslationRow } from "@/lib/db";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";
import { cn } from "@/lib/utils";

interface TranslationCellProps {
    row: TranslationRow;
    langCode: string;
}

export const TranslationCell = memo(({ row, langCode }: TranslationCellProps) => {
    const dbValue = row.values[langCode] || "";
    const originalValue = row.originalValues?.[langCode] || "";
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { selectedRange, editSession, setSelectedRange, beginEditing, setDraftValue, cancelEditing, commitActiveEdit } = useSpreadsheetStore();
    const isInteractionLocked = useSpreadsheetStore((state) => Object.keys(state.interactionLocks).length > 0);
    const coordinate = useMemo(() => ({ rowId: row.id, langCode }), [row.id, langCode]);
    const isEditing = editSession?.rowId === row.id && editSession?.langCode === langCode;
    const value = isEditing ? editSession.draftValue : dbValue;
    const isSelected = selectedRange?.start.rowId === row.id && selectedRange.start.langCode === langCode;

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    const finishAndNavigate = async (direction: "next" | "previous" | "down") => {
        const saved = await commitActiveEdit();
        if (!saved) {
            toast.error("Không thể lưu ô đang sửa. Dữ liệu vẫn được giữ để bạn thử lại.");
            return;
        }
        window.dispatchEvent(new CustomEvent("our18n:navigate-cell", { detail: { direction } }));
    };

    const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelEditing();
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            await finishAndNavigate(event.shiftKey ? "previous" : "next");
            return;
        }

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            await finishAndNavigate("down");
        }
    };

    const handleCellMouseDown = async (event: React.MouseEvent) => {
        if (isInteractionLocked) return;
        if (isEditing) return;
        event.preventDefault();

        if (editSession) {
            const saved = await commitActiveEdit();
            if (!saved) {
                toast.error("Hãy xử lý lỗi lưu ở ô hiện tại trước khi chuyển ô.");
                return;
            }
        }

        if (event.shiftKey && selectedRange) {
            setSelectedRange({ start: selectedRange.start, end: coordinate });
        } else if (isSelected) {
            beginEditing(coordinate, dbValue);
        } else {
            setSelectedRange({ start: coordinate, end: coordinate });
        }
    };

    return (
        <div
            onMouseDown={handleCellMouseDown}
            className={cn(
                "relative w-full h-full flex items-stretch select-none transition-all min-w-[250px] border border-transparent outline-none bg-inherit",
                isSelected && "bg-blue-500/[0.06] dark:bg-blue-500/10 ring-2 ring-blue-600 ring-inset z-20 shadow-sm rounded-sm",
            )}
        >
            {dbValue !== originalValue && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-10 pointer-events-none" />}
            {!value.trim() && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 z-10 pointer-events-none" />}

            {!isEditing ? (
                <div className="w-full py-3 pr-3 pl-4 font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap break-word overflow-wrap-anywhere overflow-hidden cursor-cell select-none">
                    {value || <span className="text-muted-foreground/30 italic">...</span>}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(event) => setDraftValue(event.target.value)}
                    onBlur={() => { void commitActiveEdit(); }}
                    onKeyDown={handleKeyDown}
                    aria-invalid={editSession.status === "error"}
                    title={editSession.error}
                    placeholder="Nhập bản dịch..."
                    rows={1}
                    className={cn(
                        "w-full bg-background resize-none py-3 pr-3 pl-4 rounded-none border transition-all outline-none cursor-text font-sans text-sm text-foreground leading-relaxed z-40 shadow-inner",
                        editSession.status === "error" ? "border-red-500" : "border-transparent",
                    )}
                    style={{ height: "auto" }}
                />
            )}
        </div>
    );
});

TranslationCell.displayName = "TranslationCell";
