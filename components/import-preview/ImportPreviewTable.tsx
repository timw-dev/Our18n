"use client";

import React, { useEffect, useRef } from "react";
import { type PreviewRow } from "@/lib/import-utils";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Check, Database, Trash2 } from "lucide-react";

interface ImportPreviewTableProps {
    rows: PreviewRow[];
    languages: string[];
    onCellValueChange: (rowId: string, lang: string, newValue: string) => void;
    onResolveConflict?: (rowId: string, lang: string, choice: "local" | "incoming") => void;
    resolutions?: Record<string, "local" | "incoming">;
}

export default function ImportPreviewTable({
    rows,
    languages,
    onCellValueChange,
    onResolveConflict,
    resolutions = {}
}: ImportPreviewTableProps) {
    if (rows.length === 0) return null;

    return (
        <div className="w-full overflow-hidden rounded-lg border border-muted bg-background">
            <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/40 font-medium text-muted-foreground select-none">
                        <th className="p-3 font-semibold text-foreground w-[20%] min-w-[150px] break-all">Từ khóa (Key)</th>
                        {languages.map((lang) => (
                            <th key={lang} className="p-3 font-semibold text-foreground uppercase tracking-wider break-all">
                                {lang}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                    {rows.map((row) => (
                        <tr
                            key={row.id}
                            className={cn(
                                "hover:bg-muted/5 transition-colors group border-b border-muted/60",
                                row.status === "added" && "bg-green-500/[0.02] dark:bg-green-500/[0.01]",
                                row.status === "updated" && "bg-blue-500/[0.02] dark:bg-blue-500/[0.01]",
                                row.status === "conflicted" && "bg-amber-500/[0.02] dark:bg-amber-500/[0.01]"
                            )}
                        >
                            {/* Cột hiển thị Key */}
                            <td className="p-3 align-top font-mono text-[12px] font-bold text-amber-600 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors break-all select-none">
                                {row.key}
                            </td>

                            {/* Các cột hiển thị Ngôn ngữ */}
                            {languages.map((lang) => {
                                const val = row.values[lang] || "";
                                const localVal = row.localValues?.[lang] || "";
                                const isMissing = !val.trim();

                                // SỬA ĐIỀU KIỆN: Đón chặn mọi kịch bản lệch dữ liệu (kể cả khi rỗng/lược xóa)
                                const isConflictedCell = row.status === "conflicted" && val !== localVal;
                                const currentResolution = resolutions[`${row.id}_${lang}`];

                                if (isConflictedCell) {
                                    return (
                                        <td key={lang} className="p-3 align-top border-l border-muted/50 bg-amber-500/[0.02] relative min-h-[120px]">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-30" />

                                            <div className="flex flex-col gap-2 text-[12px]">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1 select-none">
                                                    <ArrowLeftRight className="w-3 h-3" /> Phát hiện xung đột
                                                </div>

                                                {/* Khối hiển thị bản hiện tại trên máy (Local) */}
                                                <button
                                                    type="button"
                                                    onClick={() => onResolveConflict?.(row.id, lang, "local")}
                                                    className={cn(
                                                        "w-full text-left p-2 rounded border border-muted transition-all flex flex-col gap-0.5",
                                                        currentResolution === "local" ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500" : "bg-muted/20 hover:bg-muted/40"
                                                    )}
                                                >
                                                    <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                        <Database className="w-2.5 h-2.5" /> Bản hiện tại trên máy (Local)
                                                    </span>
                                                    <span className={cn("text-foreground/90 font-sans break-all", !localVal.trim() && "text-muted-foreground/50 italic text-xs flex items-center gap-1")}>
                                                        {localVal.trim() ? localVal : <><Trash2 className="w-3 h-3 text-red-500" /> [Trống / Bản dịch đã bị xóa]</>}
                                                    </span>
                                                </button>

                                                {/* Khối hiển thị bản mới nạp vào (Incoming) */}
                                                <button
                                                    type="button"
                                                    onClick={() => onResolveConflict?.(row.id, lang, "incoming")}
                                                    className={cn(
                                                        "w-full text-left p-2 rounded border border-muted transition-all flex flex-col gap-0.5",
                                                        currentResolution === "incoming" ? "border-green-600 bg-green-500/10 ring-1 ring-green-600" : "bg-muted/20 hover:bg-muted/40"
                                                    )}
                                                >
                                                    <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                        📥 Bản mới nhập vào (Incoming)
                                                    </span>
                                                    <span className={cn("text-foreground/90 font-sans break-all", !val.trim() && "text-muted-foreground/50 italic text-xs flex items-center gap-1")}>
                                                        {val.trim() ? val : <><Trash2 className="w-3 h-3 text-red-500" /> [Trống / Bản dịch mới yêu cầu xóa]</>}
                                                    </span>
                                                </button>

                                                {/* Trạng thái lựa chọn hiện tại */}
                                                <div className="text-[10px] text-muted-foreground/70 italic mt-0.5 select-none flex items-center gap-1 justify-end font-semibold">
                                                    {currentResolution === "incoming" ? (
                                                        <span className="text-green-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Chấp nhận ghi đè bản mới</span>
                                                    ) : (
                                                        <span className="text-amber-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Giữ nguyên bản cũ trên máy</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    );
                                }

                                // ĐỐI VỚI CÁC Ô THÔNG THƯỜNG (ADDED / UPDATED SAFE)
                                const isChanged = row.status === "updated" && val !== localVal;

                                return (
                                    <td key={lang} className="p-0 align-top border-l border-muted/50 relative transition-all">
                                        {isChanged && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-30" />}
                                        {isMissing && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 z-30" />}

                                        <AutoResizeTextarea
                                            value={val}
                                            onChange={(newValue) => onCellValueChange(row.id, lang, newValue)}
                                            isMissing={isMissing}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AutoResizeTextarea({ value, onChange, isMissing }: { value: string; onChange: (v: string) => void; isMissing: boolean }) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={1}
            placeholder="Nhập bản dịch..."
            className={cn(
                "w-full bg-transparent resize-none p-3 border border-transparent transition-all outline-none cursor-text font-sans text-sm text-foreground leading-relaxed focus:bg-muted/40 placeholder:text-muted-foreground/30 placeholder:italic break-words whitespace-pre-wrap overflow-hidden",
                isMissing && "bg-red-500/[0.02]"
            )}
            onInput={adjustHeight}
        />
    );
}