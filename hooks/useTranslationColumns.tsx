"use client";

import { useEffect, useRef, useMemo } from "react";
import { TranslationCell } from "@/components/table/TranslationCell";
import { Badge } from "@/components/ui/badge";
import { type Namespace, type Project, type TranslationRow, db } from "@/lib/db";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { EyeOff, MoreHorizontal, Trash, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/app/store/useAppStore";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function IndeterminateCheckbox({
    indeterminate,
    className = "",
    ...rest
}: { indeterminate?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (typeof indeterminate === 'boolean' && ref.current) {
            ref.current.indeterminate = !rest.checked && indeterminate;
        }
    }, [ref, indeterminate, rest.checked]);

    return (
        <input type="checkbox" ref={ref} className={className + " cursor-pointer"} {...rest} />
    );
}

export function useTranslationColumns(project?: Project, namespaces: Namespace[] = []) {
    const namespaceMap = useMemo(() => {
        const map = new Map<string, Namespace>();
        namespaces.forEach(ns => map.set(ns.id, ns));
        return map;
    }, [namespaces]);

    return useMemo<ColumnDef<TranslationRow>[]>(() => {
        if (!project) return [];
        const allLanguages = project.languages;

        const handleDeleteLanguage = async (langToRemove: string) => {
            const projectId = useAppStore.getState().activeProjectId;
            if (!projectId) return;

            // SỬA MỤC 6: Bản copy confirm modal rõ ràng, chi tiết cấu trúc loại bỏ
            const confirm = window.confirm(
                `XÓA NGÔN NGỮ "${langToRemove.toUpperCase()}"?\n\nHành động này sẽ xóa sạch TOÀN BỘ dữ liệu bản dịch của cột này khỏi dự án hiện tại.\nHành động này không thể hoàn tác trừ khi bạn khôi phục lại một Snapshot cũ.\n\nBạn có chắc chắn muốn xóa không?`
            );
            if (!confirm) return;

            try {
                const proj = await db.projects.get(projectId);
                if (proj) {
                    await db.projects.update(projectId, {
                        languages: proj.languages.filter(l => l !== langToRemove),
                        updatedAt: new Date().toISOString()
                    });
                    toast.success(`Đã xóa ngôn ngữ ${langToRemove.toUpperCase()} thành công`);
                }
            } catch (error) {
                toast.error("Gặp lỗi khi xóa ngôn ngữ.");
            }
        };

        return [
            {
                id: "select",
                size: 40,
                header: ({ table }) => (
                    <div className="flex justify-center items-center w-full h-full px-1">
                        <IndeterminateCheckbox
                            className="w-4 h-4 accent-primary rounded-sm border-muted-foreground/50"
                            checked={table.getIsAllPageRowsSelected()}
                            indeterminate={table.getIsSomePageRowsSelected()}
                            onChange={table.getToggleAllPageRowsSelectedHandler()}
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="flex justify-center items-center w-full h-full px-1">
                        <IndeterminateCheckbox
                            className="w-4 h-4 accent-primary rounded-sm border-muted-foreground/50"
                            checked={row.getIsSelected()}
                            onChange={row.getToggleSelectedHandler()}
                        />
                    </div>
                ),
            },
            {
                id: "stt",
                header: () => <div className="text-center font-bold text-muted-foreground">No.</div>,
                size: 50,
                cell: ({ row }) => (
                    <div className="flex justify-center items-center w-full h-full px-1">
                        <span className="font-mono text-[11px] text-muted-foreground">{row.index + 1}</span>
                    </div>
                ),
            },
            {
                id: "key_namespace",
                accessorFn: (row: TranslationRow) => `${row.namespaceId} ${row.key}`,
                header: "Key & Namespace",
                size: 250,
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    const ns = namespaceMap.get(row.original.namespaceId);
                    const shortPath = ns ? ns.fileName : "Unknown File";
                    const fullPath = ns ? (ns.folderPath === '/' ? ns.fileName : `${ns.folderPath}/${ns.fileName}`) : row.original.namespaceId;
                    return (
                        <div className="max-w-full p-2 pl-3">
                            <div className="font-mono text-[13px] font-semibold truncate text-primary/90">{row.original.key}</div>
                            <div title={fullPath} className="text-[11px] text-muted-foreground truncate mt-0.5 cursor-help w-fit hover:text-primary transition-colors">
                                📄 {shortPath}
                            </div>
                        </div>
                    );
                },
            },
            ...allLanguages.map((langCode): ColumnDef<TranslationRow> => ({
                id: `lang_${langCode}`,
                accessorFn: (row: TranslationRow) => row.values[langCode],
                // size: 300,
                header: ({ column }) => (
                    <div className="flex items-center justify-between w-full group pr-1">
                        <span>{langCode.toUpperCase()}</span>
                        <DropdownMenu>
                            {/* SỬA: Loại bỏ hẳn asChild nguy hiểm ở đây */}
                            <DropdownMenuTrigger
                                title="Column actions"
                                className={cn(
                                    buttonVariants({ variant: "ghost", size: "icon" }),
                                    "h-6 w-6 opacity-40 group-hover:opacity-100 transition-opacity cursor-pointer focus-visible:ring-1 focus-visible:ring-primary outline-none"
                                )}
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => column.toggleVisibility(false)} className="cursor-pointer">
                                    <EyeOff className="w-4 h-4 mr-2 text-muted-foreground" /> Ẩn cột này
                                </DropdownMenuItem>
                                {/* SỬA MỤC 6: Phân tách rõ màu danger trực quan */}
                                <DropdownMenuItem onClick={() => handleDeleteLanguage(langCode)} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 font-medium">
                                    <Trash className="w-4 h-4 mr-2" /> Xóa ngôn ngữ
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
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
                header: () => <div className="text-center w-full">Trạng thái</div>,
                size: 100,
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    const activeLangs = project?.languages || [];

                    const isMissing = activeLangs.some(lang => !row.original.values[lang]?.trim());

                    const changeStatus = row.original.changeStatus;
                    return (
                        <div className="flex items-center justify-center h-full w-full min-h-12.5 bg-inherit">
                            {isMissing && <Badge variant="destructive" className="text-base h-6 px-2.5 rounded-sm bg-red-500/90 hover:bg-red-500">Missing</Badge>}
                            {changeStatus !== "unchanged" && !isMissing && (
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
                size: 60,
                cell: ({ row }) => {
                    const isDeleted = row.original.changeStatus === 'deleted';
                    const handleToggleDelete = async () => {
                        try {
                            let revertStatus: "unchanged" | "updated" = "unchanged";
                            if (isDeleted) {
                                const isChanged = Object.keys(row.original.values).some(l => row.original.values[l] !== row.original.originalValues[l]);
                                revertStatus = isChanged ? "updated" : "unchanged";
                            }
                            await db.translationRows.update(row.original.id, {
                                changeStatus: isDeleted ? revertStatus : 'deleted',
                                updatedAt: new Date().toISOString()
                            });
                            toast.success(isDeleted ? "Đã khôi phục dòng!" : "Đã đánh dấu xóa!");
                        } catch (error) {
                            toast.error("Lỗi khi thao tác với dòng này.");
                        }
                    };
                    return (
                        <div className="flex items-center justify-center w-full bg-inherit h-full">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleToggleDelete}
                                className={`h-8 w-8 transition-colors ${isDeleted ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' : 'text-muted-foreground hover:text-red-500 hover:bg-red-50'}`}
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