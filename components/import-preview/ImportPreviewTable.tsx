"use client";

import React, { useEffect, useRef } from "react";
import { type PreviewRow } from "@/lib/import-utils";
import { cn } from "@/lib/utils";

interface ImportPreviewTableProps {
    rows: PreviewRow[];
    languages: string[];
    onCellValueChange: (rowId: string, lang: string, newValue: string) => void;
}

export default function ImportPreviewTable({ rows, languages, onCellValueChange }: ImportPreviewTableProps) {
    if (rows.length === 0) return null;

    return (
        <div className="w-full overflow-hidden rounded-lg border border-muted bg-background">
            <table className="w-full table-fixed border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b bg-muted/40 font-medium text-muted-foreground select-none">
                        {/* Cột Key cố định tỉ lệ gọn gàng, nhường chỗ cho text dịch thuật */}
                        <th className="p-3 font-semibold text-foreground w-[20%] min-w-[150px] break-all">Từ khóa (Key)</th>
                        {/* Các cột ngôn ngữ tự động chia đều không gian còn lại */}
                        {languages.map((lang) => (
                            <th key={lang} className="p-3 font-semibold text-foreground uppercase tracking-wider break-all">
                                {lang}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                    {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/5 transition-colors group">
                            {/* Cột hiển thị Key */}
                            <td className="p-3 align-top font-mono text-[12px] font-bold text-amber-600 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors break-all select-none">
                                {row.key}
                            </td>

                            {/* Các cột hiển thị Ngôn ngữ tự động bẻ hàng xuống dòng */}
                            {languages.map((lang) => {
                                const val = row.values[lang] || "";
                                const localVal = row.localValues?.[lang] || "";

                                const isChanged = row.status === "updated" && val !== localVal;
                                const isMissing = !val.trim();

                                return (
                                    <td
                                        key={lang}
                                        className="p-0 align-top border-l border-muted/50 relative transition-all"
                                    >
                                        {/* Thanh chỉ báo màu sắc biên trái từ TranslationCell */}
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

// Sub-component phụ trách việc tự động tính toán chiều cao
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