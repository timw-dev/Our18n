"use client";
import { SaveSnapshotDialog } from "./SaveSnapshotDialog";
import { useState, useMemo } from "react";
import { type Table as TanStackTable } from "@tanstack/react-table";
import { Download, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";

import { db, type TranslationRow } from "@/lib/db";
import { exportProjectAsZip } from "@/lib/export-utils";
import { useAppStore } from "@/app/store/useAppStore";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";

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

    // 1. QUERY KIỂM TRA XEM CÓ TRÙNG KHỚP PHIÊN BẢN NÀO ĐANG ĐƯỢC XEM KHÔNG
    // Trong kiến trúc lưu trữ của bạn, nếu working copy hiện tại trùng khớp hoàn toàn với một version,
    // hoặc bạn có state activeVersionId trong Store, bạn có thể gọi trực tiếp.
    // Dưới đây là giải pháp tối ưu: Tìm kiếm metadata dựa trên trạng thái làm việc (hoặc sync từ Store của bạn nếu có)
    const allVersions = useLiveQuery(
        () => activeProjectId ? db.versions.where({ projectId: activeProjectId }).toArray() : [],
        [activeProjectId]
    );

    // Giả định bạn lưu activeVersionId trong Store, hoặc nếu không, bạn có thể đọc trạng thái checkout.
    // Ở đây mình tạo cấu trúc lấy thông tin dựa trên store hoặc tìm kiếm version matching.
    const { activeVersionId } = useAppStore(); // Đảm bảo bổ sung trường này vào useAppStore nếu bạn có làm tính năng checkout

    const currentVersionName = useMemo(() => {
        if (!allVersions || allVersions.length === 0) return undefined;
        if (activeVersionId) {
            return allVersions.find(v => v.id === activeVersionId)?.name;
        }
        // Trường hợp không có activeId cố định, nếu không có thay đổi (hasChanges = false), 
        // bạn có thể lấy tên của version mới nhất làm context (tùy chọn)
        return undefined;
    }, [allVersions, activeVersionId]);

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

    // 2. TRUYỀN THÊM VERSION NAME VÀO PIPELINE EXPORT
    const handleExport = async () => {
        if (!activeProjectId || isTableEmpty) return;

        setIsExporting(true);
        const toastId = toast.loading("Đang nén file Export...");

        try {
            const project = await db.projects.get(activeProjectId);
            if (!project) throw new Error("Project không tồn tại");

            // Truyền thêm tên phiên bản hiện hành vào hàm tiện ích
            await exportProjectAsZip(activeProjectId, project.name, currentVersionName);

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

                <div className="flex items-center gap-2 pl-4 border-l">
                    {activeProjectId && (
                        <>
                            {/* TRUYỀN TÊN PHIÊN BẢN HIỆN TẠI VÀO ĐÂY */}
                            <VersionHistoryPanel
                                projectId={activeProjectId}
                                currentVersionName={currentVersionName}
                            />
                            <SaveSnapshotDialog
                                projectId={activeProjectId}
                                hasChanges={hasChanges}
                            />
                        </>
                    )}

                    <Button
                        onClick={handleExport}
                        disabled={isTableEmpty || isExporting}
                        className="gap-2 shadow-sm"
                        variant="outline"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Export ZIP
                    </Button>
                </div>
            </div>
        </div>
    );
}