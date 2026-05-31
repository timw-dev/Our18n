"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { updateTranslationCell, type TranslationRow } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";

interface TranslationCellProps {
    row: TranslationRow;
    langCode: string;
}

export function TranslationCell({ row, langCode }: TranslationCellProps) {
    const dbValue = row.values[langCode] || "";
    const originalValue = row.originalValues?.[langCode] || "";

    const [value, setValue] = useState(dbValue);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(dbValue);
    }, [dbValue]);

    const handleBlur = async () => {
        if (value === dbValue) return;

        try {
            await updateTranslationCell(row.id, langCode, value);
            useAppStore.getState().setActiveVersion(null);
        } catch (error) {
            console.error("Lỗi khi auto-save:", error);
        }
    };

    const isChanged = dbValue !== originalValue;
    const isMissing = !value.trim();

    const cellStyles = isChanged
        ? "border-l-2 border-amber-500 pl-1 bg-amber-50/30 dark:bg-amber-900/10"
        : isMissing
            ? "border-l-2 border-red-300 bg-red-50/50 dark:bg-red-900/10"
            : "";

    return (
        <div className={`relative transition-colors ${cellStyles}`}>
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleBlur}
                placeholder="Nhập bản dịch..."
                className="h-8 w-full rounded-sm border-transparent bg-transparent px-2 py-1 shadow-none hover:border-input focus:border-input"
            />
        </div>
    );
}