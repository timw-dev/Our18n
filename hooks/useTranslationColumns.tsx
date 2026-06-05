"use client";

import { TranslationCell } from "@/components/table/TranslationCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Namespace, type Project, type TranslationRow, db } from "@/lib/db";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Trash2, Undo2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export function useTranslationColumns(project?: Project, namespaces: Namespace[] = []) {
    // Lookup Map O(1) để lấy thông tin Namespace cực nhanh thay vì find() trong mảng
    const namespaceMap = useMemo(() => {
        const map = new Map<string, Namespace>();
        namespaces.forEach(ns => map.set(ns.id, ns));
        return map;
    }, [namespaces]);

    return useMemo<ColumnDef<TranslationRow>[]>(() => {
        if (!project) return [];

        const defaultLang = project.defaultLanguage;
        // Mảng toàn bộ ngôn ngữ hiển thị theo thứ tự để tính toán colIdx chuẩn Spreadsheet
        const allLanguages = project.languages;
        const targetLangs = allLanguages.filter((l) => l !== defaultLang);

        return [
            {
                id: "stt",
                header: () => <div className="text-center font-bold text-muted-foreground">No.</div>,
                size: 50,
                cell: ({ row }) => (
                    <div className="text-center font-mono text-[11px] text-muted-foreground w-full">
                        {row.index + 1}
                    </div>
                ),
            },
            {
                id: "key_namespace",
                accessorFn: (row: TranslationRow) => `${row.namespaceId} ${row.key}`,
                header: "Key & Namespace",
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    const ns = namespaceMap.get(row.original.namespaceId);
                    const shortPath = ns ? ns.fileName : "Unknown File";
                    const fullPath = ns ? (ns.folderPath === '/' ? ns.fileName : `${ns.folderPath}/${ns.fileName}`) : row.original.namespaceId;

                    return (
                        <div className="max-w-[200px] p-1">
                            <div className="font-mono text-[13px] font-semibold truncate text-primary/90">
                                {row.original.key}
                            </div>
                            <div
                                title={fullPath}
                                className="text-[11px] text-muted-foreground truncate mt-0.5 cursor-help w-fit max-w-full hover:text-primary transition-colors"
                            >
                                📄 {shortPath}
                            </div>
                        </div>
                    );
                },
            },
            {
                id: `lang_${defaultLang}`,
                accessorFn: (row: TranslationRow) => row.values[defaultLang],
                header: `Gốc (${defaultLang.toUpperCase()})`,
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    // Loại bỏ hoàn toàn div bọc ngoài lãng phí để Cell chiếm trọn không gian thẻ td
                    return (
                        <TranslationCell
                            row={row.original}
                            langCode={defaultLang}
                            rowIdx={row.index}
                            colIdx={allLanguages.indexOf(defaultLang)}
                        />
                    );
                },
            },
            ...targetLangs.map((langCode): ColumnDef<TranslationRow> => ({
                id: `lang_${langCode}`,
                accessorFn: (row: TranslationRow) => row.values[langCode],
                header: `Bản dịch (${langCode.toUpperCase()})`,
                cell: ({ row }: { row: Row<TranslationRow> }) => (
                    <TranslationCell
                        row={row.original}
                        langCode={langCode}
                        rowIdx={row.index}
                        colIdx={allLanguages.indexOf(langCode)}
                    />
                ),
            })),
            {
                id: "status",
                accessorKey: "changeStatus",
                header: () => <div className="text-center">Trạng thái</div>,
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    const isMissing = Object.values(row.original.translationStatus).includes('missing');
                    const changeStatus = row.original.changeStatus;

                    return (
                        <div className="flex items-center justify-center h-full w-full min-h-12.5">
                            {isMissing && (
                                <Badge variant="destructive" className="text-base h-6 px-2.5 rounded-sm bg-red-500/90 hover:bg-red-500">
                                    Missing
                                </Badge>
                            )}
                            {changeStatus !== "unchanged" && (
                                <Badge
                                    variant={changeStatus === "added" ? "default" : changeStatus === "deleted" ? "destructive" : "secondary"}
                                    className={`text-base h-6 px-2.5 rounded-sm ${changeStatus === 'updated' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : ''}`}
                                >
                                    {changeStatus === "added" ? "New" : changeStatus === "deleted" ? "Deleted" : "Updated"}
                                </Badge>
                            )}
                        </div>
                    );
                },
            },
            {
                id: "actions",
                header: "",
                size: 50,
                cell: ({ row }) => {
                    const isDeleted = row.original.changeStatus === 'deleted';

                    const handleToggleDelete = async () => {
                        try {
                            let revertStatus: "unchanged" | "updated" = "unchanged";
                            if (isDeleted) {
                                const isChanged = Object.keys(row.original.values).some(
                                    l => row.original.values[l] !== row.original.originalValues[l]
                                );
                                revertStatus = isChanged ? "updated" : "unchanged";
                            }

                            await db.translationRows.update(row.original.id, {
                                changeStatus: isDeleted ? revertStatus : 'deleted',
                                updatedAt: new Date().toISOString()
                            });

                            if (isDeleted) {
                                toast.success("Đã hoàn tác. Dòng đã được khôi phục!");
                            } else {
                                toast.success("Đã đánh dấu xóa. Nhớ bấm Lưu Snapshot để chốt!");
                            }
                        } catch (error) {
                            toast.error("Lỗi khi thao tác với dòng này.");
                        }
                    };

                    return (
                        <div className="flex items-center justify-center">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleToggleDelete}
                                className={`h-8 w-8 transition-colors ${isDeleted
                                    ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                                    : 'text-muted-foreground hover:text-red-500 hover:bg-red-50'
                                    }`}
                                title={isDeleted ? "Hoàn tác (Khôi phục dòng)" : "Đánh dấu xóa"}
                            >
                                {isDeleted ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                        </div>
                    );
                }
            }
        ];
    }, [project, namespaceMap]);
}