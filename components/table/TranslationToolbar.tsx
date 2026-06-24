"use client";
import { SaveSnapshotDialog } from "./SaveSnapshotDialog";
import { useState, useMemo } from "react";
import { type Table as TanStackTable } from "@tanstack/react-table";
import { Trash2, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";

import { db, type TranslationRow } from "@/lib/db";
import { exportProjectAsZip } from "@/lib/export-utils";
import { useAppStore } from "@/app/store/useAppStore";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button, buttonVariants } from "@/components/ui/button";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";
import { cn } from "@/lib/utils";

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportDialog } from "@/components/table/ExportDialog";

interface TranslationToolbarProps {
    table: TanStackTable<TranslationRow>;
    totalRows: number;
}

export function TranslationToolbar({ table, totalRows }: TranslationToolbarProps) {
    const { activeProjectId } = useAppStore();
    const [newLang, setNewLang] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const editSession = useSpreadsheetStore((state) => state.editSession);
    const commitActiveEdit = useSpreadsheetStore((state) => state.commitActiveEdit);

    const filteredRows = table.getFilteredRowModel().rows.length;
    const isTableEmpty = totalRows === 0;

    const selectedRows = table.getSelectedRowModel().rows;
    const isRowSelected = selectedRows.length > 0;

    const allVersions = useLiveQuery(
        () => activeProjectId ? db.versions.where({ projectId: activeProjectId }).toArray() : [],
        [activeProjectId]
    );

    const { activeVersionId } = useAppStore();

    const currentVersionName = useMemo(() => {
        if (!allVersions || allVersions.length === 0) return undefined;
        if (activeVersionId) return allVersions.find(v => v.id === activeVersionId)?.name;
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

    // NÂNG CẤP: Chấp nhận mảng filter ngôn ngữ từ Dialog truyền lên
    const handleExport = async (selectedLanguages?: string[]) => {
        if (!activeProjectId || isTableEmpty) return;
        setIsExporting(true);
        const toastId = toast.loading("Đang nén file Export...");
        try {
            const committed = await commitActiveEdit();
            if (!committed) throw new Error("Không thể commit ô đang chỉnh sửa");
            const project = await db.projects.get(activeProjectId);
            if (!project) throw new Error("Project không tồn tại");

            // Truyền mảng lọc ngôn ngữ xuống export-utils
            await exportProjectAsZip(activeProjectId, project.name, currentVersionName, {
                languageCodes: selectedLanguages
            });

            toast.success("Export thành công!", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi Export file. Vui lòng thử lại.", { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!activeProjectId) return;
        const confirm = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedRows.length} dòng bản dịch này khỏi dự án?`);
        if (!confirm) return;

        try {
            const committed = await commitActiveEdit();
            if (!committed) throw new Error("Không thể commit ô đang chỉnh sửa");
            await db.transaction("rw", db.translationRows, async () => {
                await Promise.all(selectedRows.map(row => db.translationRows.update(row.original.id, {
                    changeStatus: "deleted",
                    updatedAt: new Date().toISOString(),
                })));
            });
            useAppStore.getState().setActiveVersion(null);
            table.resetRowSelection();
            toast.success(`Đã đánh dấu xóa ${selectedRows.length} dòng. Các dòng sẽ được xóa khi lưu Snapshot.`);
        } catch (error) {
            toast.error("Lỗi khi xóa hàng loạt.");
        }
    };

    const hasPersistedChanges = table.getPreFilteredRowModel().rows.some(
        row => row.original.changeStatus !== 'unchanged'
    );
    const hasChanges = hasPersistedChanges || Boolean(editSession && editSession.draftValue !== editSession.baseValue);

    const languageColumns = table.getAllLeafColumns().filter(column => column.id.startsWith("lang_"));

    const visibleLanguagesList = useMemo(() => {
        return languageColumns
            .filter(col => col.getIsVisible())
            .map(col => col.id.replace("lang_", ""));
    }, [languageColumns]);

    const allLanguagesList = useMemo(() => {
        return languageColumns.map(col => col.id.replace("lang_", ""));
    }, [languageColumns]);

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 border rounded-md">
            <div className="flex items-center gap-4">
                {isRowSelected ? (
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                            Đã chọn {selectedRows.length} dòng
                        </span>
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={handleBulkDelete}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Xóa hàng loạt
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => table.resetRowSelection()}>
                            Hủy bỏ
                        </Button>
                    </div>
                ) : (
                    <Input
                        placeholder="Tìm kiếm key, nội dung..."
                        value={table.getState().globalFilter ?? ""}
                        onChange={(e) => table.setGlobalFilter(e.target.value)}
                        className="w-64 bg-background"
                    />
                )}

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
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={cn(
                                buttonVariants({ variant: "outline" }),
                                "gap-2 shadow-sm bg-background cursor-pointer outline-none"
                            )}
                        >
                            <Columns3 className="w-4 h-4 text-muted-foreground" />
                            Hiển thị
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {languageColumns.map((column) => {
                                const langName = column.id.replace("lang_", "").toUpperCase();
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize cursor-pointer"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    >
                                        Bản dịch ({langName})
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {activeProjectId && (
                        <>
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

                    {/* SỬA: Thay thế bằng ExportDialog bọc chuẩn chỉ */}
                    <ExportDialog
                        allLanguages={allLanguagesList}
                        visibleLanguages={visibleLanguagesList}
                        isExporting={isExporting}
                        isTableEmpty={isTableEmpty}
                        onExport={handleExport}
                    />
                </div>
            </div>
        </div>
    );
}
