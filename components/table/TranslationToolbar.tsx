"use client";
import { SaveSnapshotDialog } from "./SaveSnapshotDialog";
import { useState } from "react";
import { type Table as TanStackTable } from "@tanstack/react-table";
import { Download, Loader2 } from "lucide-react"; // Dùng icon của lucide-react
import { toast } from "sonner"; // Hoặc useToast của shadcn nếu bạn xài nó

import { db, type TranslationRow } from "@/lib/db";
import { exportProjectAsZip } from "@/lib/export-utils";
import { useAppStore } from "@/app/store/useAppStore";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface TranslationToolbarProps {
    table: TanStackTable<TranslationRow>;
    totalRows: number;
}

export function TranslationToolbar({ table, totalRows }: TranslationToolbarProps) {
    const { activeProjectId } = useAppStore();
    const [newLang, setNewLang] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    const filteredRows = table.getFilteredRowModel().rows.length;
    const isTableEmpty = totalRows === 0;

    const handleAddLanguage = async () => {
        const langCode = newLang.trim().toLowerCase();
        if (!langCode || !activeProjectId) return;

        const project = await db.projects.get(activeProjectId);
        if (project) {
            if (project.languages.includes(langCode)) {
                toast.error("Ngôn ngữ này đã tồn tại!");
                return;
            }
            await db.projects.update(activeProjectId, {
                languages: [...project.languages, langCode]
            });
            setNewLang("");
            toast.success(`Đã thêm cột ngôn ngữ: ${langCode.toUpperCase()}`);
        }
    };

    const handleExport = async () => {
        if (!activeProjectId || isTableEmpty) return;

        setIsExporting(true);
        const toastId = toast.loading("Đang nén file Export...");

        try {
            const project = await db.projects.get(activeProjectId);
            if (!project) throw new Error("Project không tồn tại");

            await exportProjectAsZip(activeProjectId, project.name);

            toast.success("Export thành công!", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi Export file. Vui lòng thử lại.", { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    const hasChanges = table.getPreFilteredRowModel().rows.some(
        row => row.original.changeStatus !== 'unchanged'
    );

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 border rounded-md">
            <div className="flex items-center gap-4">
                <Input
                    placeholder="Tìm kiếm key, nội dung..."
                    value={table.getState().globalFilter ?? ""}
                    onChange={(e) => table.setGlobalFilter(e.target.value)}
                    className="w-64 bg-background"
                />

                <div className="flex items-center gap-2 pl-4 border-l">
                    <Input
                        placeholder="Mã NN (VD: ko)"
                        value={newLang}
                        onChange={(e) => setNewLang(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
                        className="w-32 bg-background"
                        maxLength={5}
                    />
                    <Button variant="secondary" onClick={handleAddLanguage} disabled={!newLang}>
                        Thêm cột
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Switch
                        onCheckedChange={(checked) => {
                            table.getColumn("status")?.setFilterValue(checked ? "updated" : undefined);
                        }}
                    />
                    <span className="font-medium text-muted-foreground">Chỉ hiện thay đổi</span>
                </label>

                <div className="text-muted-foreground font-mono bg-background px-3 py-1 rounded-md border">
                    {filteredRows} / {totalRows} keys
                </div>


                {/* NÚT EXPORT */}
                <div className="flex items-center gap-2 pl-4 border-l">
                    {activeProjectId && (
                        <SaveSnapshotDialog
                            projectId={activeProjectId}
                            hasChanges={hasChanges}
                        />
                    )}

                    <Button
                        onClick={handleExport}
                        disabled={isTableEmpty || isExporting}
                        className="gap-2"
                        variant="outline" // Đổi màu nút Export thành outline cho đỡ tranh giành sự chú ý với nút Save
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export ZIP
                    </Button>
                </div>
            </div>
        </div>
    );
}