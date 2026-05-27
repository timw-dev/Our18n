"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { updateTranslationCell, type TranslationRow } from "@/lib/db";

interface TranslationCellProps {
    row: TranslationRow;
    langCode: string;
}

export function TranslationCell({ row, langCode }: TranslationCellProps) {
    const dbValue = row.values[langCode] || "";
    const [value, setValue] = useState(dbValue);
    const [prevDbValue, setPrevDbValue] = useState(dbValue);

    // Sync external updates (Ví dụ: khi Dexie thay đổi do revert/import file)
    if (dbValue !== prevDbValue) {
        setValue(dbValue);
        setPrevDbValue(dbValue);
    }

    const handleBlur = async () => {
        if (value === dbValue) return;
        try {
            await updateTranslationCell(row.id, langCode, value);
        } catch (error) {
            console.error("Lỗi khi auto-save:", error);
        }
    };

    // UX Diffing: So sánh giá trị hiện tại với giá trị Gốc (Snapshot)
    const isChanged = row.values[langCode] !== row.originalValues[langCode];
    const isMissing = !value || value.trim() === "";

    // Nếu thay đổi -> tô viền cam và nền cam nhạt. Nếu rỗng -> nền đỏ nhạt.
    const cellStyles = isChanged
        ? "border-l-2 border-amber-500 pl-1 bg-amber-50/30 dark:bg-amber-900/10"
        : isMissing
            ? "bg-red-50/50 dark:bg-red-900/10 border-l-2 border-red-300"
            : "";

    return (
        <div className={`relative transition-colors ${cellStyles}`}>
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleBlur}
                placeholder="Nhập bản dịch..."
                className="w-full border-transparent hover:border-input focus:border-input rounded-sm px-2 py-1 h-8 bg-transparent shadow-none"
            />
        </div>
    );
}