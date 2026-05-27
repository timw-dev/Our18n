import { TranslationCell } from "@/components/table/TranslationCell";
import { Badge } from "@/components/ui/badge";
import { type Namespace, type Project, type TranslationRow } from "@/lib/db";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { useMemo } from "react";

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
        const targetLangs = project.languages.filter((l) => l !== defaultLang);

        return [
            {
                id: "key_namespace",
                accessorFn: (row: TranslationRow) => `${row.namespaceId} ${row.key}`,
                header: "Key & Namespace",
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    const ns = namespaceMap.get(row.original.namespaceId);
                    const shortPath = ns ? ns.fileName : "Unknown File";
                    const fullPath = ns ? (ns.folderPath === '/' ? ns.fileName : `${ns.folderPath}/${ns.fileName}`) : row.original.namespaceId;

                    return (
                        <div className="max-w-[200px]">
                            <div className="font-mono text-[13px] font-semibold truncate text-primary/90">
                                {row.original.key}
                            </div>

                            {/* DÙNG NATIVE HTML TITLE: Siêu nhẹ, siêu nhanh, không lỗi TS */}
                            <div
                                title={fullPath} // Trình duyệt tự lo việc hiển thị Tooltip khi hover
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
                    const val = row.original.values[defaultLang];
                    const isMissing = !val || val.trim() === "";

                    return (
                        <div className={`font-medium min-w-[200px] p-2 text-sm ${isMissing ? 'text-red-400 italic' : ''}`}>
                            {val || "Trống (Missing)"}
                        </div>
                    );
                },
            },
            ...targetLangs.map((langCode): ColumnDef<TranslationRow> => ({
                id: `lang_${langCode}`,
                accessorFn: (row: TranslationRow) => row.values[langCode],
                header: `Bản dịch (${langCode.toUpperCase()})`,
                cell: ({ row }: { row: Row<TranslationRow> }) => (
                    <div className="min-w-[250px]">
                        <TranslationCell row={row.original} langCode={langCode} />
                    </div>
                ),
            })),
            {
                id: "status",
                accessorKey: "changeStatus",
                header: () => <div className="text-right">Trạng thái</div>,
                cell: ({ row }: { row: Row<TranslationRow> }) => {
                    // Check xem có ngôn ngữ nào bị missing không
                    const isMissing = Object.values(row.original.translationStatus).includes('missing');
                    const changeStatus = row.original.changeStatus;

                    return (
                        <div className="flex flex-col items-end gap-1 pt-1">
                            {/* Badge Missing */}
                            {isMissing && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-sm bg-red-500/90 hover:bg-red-500">
                                    Missing
                                </Badge>
                            )}
                            {/* Badge Updated/Added */}
                            {changeStatus !== "unchanged" && (
                                <Badge
                                    variant={changeStatus === "added" ? "default" : "secondary"}
                                    className={`text-[10px] h-4 px-1.5 rounded-sm ${changeStatus === 'updated' ? 'bg-amber-500/10 text-amber-600 border-amber-200' : ''}`}
                                >
                                    {changeStatus === "added" ? "New" : "Updated"}
                                </Badge>
                            )}
                        </div>
                    );
                },
            },
        ];
    }, [project, namespaceMap]);
}