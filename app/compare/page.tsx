"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, GitCompare, ArrowRight, Search, FileText } from "lucide-react";

import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// --- ĐỊNH NGHĨA TYPE CHO BẢNG COMPARE ---
interface SnapshotRowData {
    id: string;
    namespaceId: string;
    key: string;
    values: Record<string, string>;
    originalValues: Record<string, string>;
    changeStatus: string;
    cellMeta?: Record<string, unknown>;
}

interface DiffRow {
    key: string;
    namespacePath: string;
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    languages: Record<string, { oldValue: string; newValue: string; isChanged: boolean }>;
}

function CompareContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const projectId = searchParams.get("projectId");
    const baseId = searchParams.get("base");
    const targetId = searchParams.get("target");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<'all' | 'added' | 'removed' | 'modified'>('all');

    // Fetch data từ DB
    const vA = useLiveQuery(() => baseId ? db.versions.get(baseId) : undefined, [baseId]);
    const vB = useLiveQuery(() => targetId ? db.versions.get(targetId) : undefined, [targetId]);
    const project = useLiveQuery(() => projectId ? db.projects.get(projectId) : undefined, [projectId]);
    const namespaces = useLiveQuery(() => projectId ? db.namespaces.where({ projectId }).toArray() : [], [projectId]);

    const languages = useMemo(() => project?.languages || [], [project]);
    const namespaceMap = useMemo(() => new Map(namespaces?.map(ns => [ns.id, ns.folderPath === '/' ? ns.fileName : `${ns.folderPath}/${ns.fileName}`]) || []), [namespaces]);

    const diffData = useMemo(() => {
        if (!vA || !vB) return [];
        const diffs: DiffRow[] = [];

        const baseMap = new Map(vA.snapshot.map((r: SnapshotRowData) => [`${r.namespaceId}:${r.key}`, r]));
        const targetMap = new Map(vB.snapshot.map((r: SnapshotRowData) => [`${r.namespaceId}:${r.key}`, r]));

        const allUniqueKeys = Array.from(new Set([...Array.from(baseMap.keys()), ...Array.from(targetMap.keys())]));

        for (const fullKey of allUniqueKeys) {
            const baseRow = baseMap.get(fullKey);
            const targetRow = targetMap.get(fullKey);
            const rowData = (targetRow || baseRow)!;
            const nsPath = namespaceMap.get(rowData.namespaceId) || "Unknown File";

            const diffRow: DiffRow = { key: rowData.key, namespacePath: nsPath, type: 'unchanged', languages: {} };

            if (!baseRow) diffRow.type = 'added';
            else if (!targetRow) diffRow.type = 'removed';

            let hasModification = false;
            for (const lang of languages) {
                const oldVal = baseRow?.values[lang] || "";
                const newVal = targetRow?.values[lang] || "";
                const isChanged = oldVal !== newVal;
                if (isChanged && diffRow.type === 'unchanged') hasModification = true;
                diffRow.languages[lang] = { oldValue: oldVal, newValue: newVal, isChanged };
            }

            if (hasModification) diffRow.type = 'modified';
            diffs.push(diffRow);
        }
        return diffs;
    }, [vA, vB, languages, namespaceMap]);

    const filteredData = useMemo(() => {
        return diffData.filter(d => {
            const matchesSearch = d.key.toLowerCase().includes(search.toLowerCase()) ||
                d.namespacePath.toLowerCase().includes(search.toLowerCase());
            const matchesFilter = filter === 'all' || d.type === filter;
            return matchesSearch && matchesFilter;
        });
    }, [diffData, search, filter]);

    const stats = useMemo(() => ({
        added: diffData.filter(d => d.type === 'added').length,
        removed: diffData.filter(d => d.type === 'removed').length,
        modified: diffData.filter(d => d.type === 'modified').length,
    }), [diffData]);

    if (!projectId || !baseId || !targetId) return <div className="p-12 text-center text-muted-foreground">Tham số URL không hợp lệ.</div>;
    if (vA === undefined || vB === undefined) return <div className="p-12 text-center text-muted-foreground animate-pulse">Đang tải dữ liệu so sánh...</div>;
    if (!vA || !vB) return <div className="p-12 text-center text-red-500 font-medium">Không tìm thấy dữ liệu phiên bản trong DB!</div>;

    return (
        <main className="h-screen w-screen flex flex-col bg-background overflow-hidden animate-in fade-in duration-300">

            {/* TOP HEADER: Đồng bộ khoảng đệm lớn giống trang chủ (px-8 md:px-12) */}
            <header className="h-20 border-b flex items-center justify-between px-8 md:px-12 bg-background shrink-0 z-30">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2 cursor-pointer shadow-sm rounded-lg h-9">
                        <ArrowLeft className="w-4 h-4" /> Quay lại dự án
                    </Button>
                    <div className="h-6 w-px bg-border mx-1" />
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end text-right">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">Bản cũ</span>
                            <Badge variant="outline" className="bg-muted/40 font-mono text-[11px] px-2 py-0">v{vA.version}</Badge>
                        </div>
                        <GitCompare className="w-4 h-4 text-muted-foreground/60" />
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider opacity-70">Bản mới</span>
                            <Badge className="bg-blue-600 text-white border-transparent font-mono text-[11px] px-2 py-0">v{vB.version}</Badge>
                        </div>
                    </div>
                </div>

                {/* Badge Stats tinh giản chuẩn Dashboard */}
                <div className="flex gap-4 text-xs font-semibold bg-muted/30 p-2 px-4 rounded-xl border border-border/60 shadow-inner">
                    <span className="text-emerald-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> +{stats.added} Mới
                    </span>
                    <span className="text-red-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> -{stats.removed} Xóa
                    </span>
                    <span className="text-amber-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> ~{stats.modified} Sửa
                    </span>
                </div>
            </header>

            {/* ACTION TOOLBAR: Căn lề px-8 md:px-12 thẳng hàng trục dọc */}
            <section className="py-4 px-8 md:px-12 flex gap-4 bg-background shrink-0 z-30 justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-60" />
                    <Input
                        placeholder="Tìm kiếm theo key hoặc file..."
                        className="pl-9 bg-background shadow-sm h-9 rounded-lg"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex border rounded-xl p-1 bg-muted/40 h-10 items-center shadow-inner border-border/60">
                    {(['all', 'added', 'removed', 'modified'] as const).map((f) => (
                        <Button
                            key={f}
                            variant={filter === f ? "secondary" : "ghost"}
                            size="sm"
                            className={cn(
                                "capitalize text-xs h-8 px-4 rounded-lg font-medium transition-all cursor-pointer",
                                filter === f && "shadow-sm bg-background font-semibold text-foreground border border-border/20"
                            )}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'Tất cả thay đổi' : f === 'modified' ? 'Đã sửa' : f === 'added' ? 'Mới thêm' : 'Đã xóa'}
                        </Button>
                    ))}
                </div>
            </section>

            {/* VÙNG CHỨA WORKSPACE BẢNG DỮ LIỆU: Thêm padding lớn bao bọc xung quanh tạo khoảng thở */}
            <div className="flex-1 w-full px-8 md:px-12 pb-8 overflow-hidden min-h-0 flex flex-col">

                {/* CONTAINER BẢNG CÓ CONTAINER BORDER & ROUNDED CHUẨN SHADCN */}
                <div className="flex-1 w-full overflow-auto border rounded-xl shadow-sm bg-card min-h-0 relative">
                    <table className="w-full border-collapse table-fixed text-left">

                        {/* THEAD STICKY */}
                        <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                            <tr className="text-xs font-semibold text-muted-foreground bg-muted/20 select-none">
                                <th className="p-4 text-left w-14 font-bold pl-5">No.</th>
                                <th className="p-4 text-left font-bold w-[28%] min-w-[240px]">Key & Namespace</th>
                                {languages.map(lang => (
                                    <th key={lang} className="p-4 text-left font-bold uppercase border-l border-border/50 min-w-[280px]">
                                        Ngôn ngữ (<span className="text-foreground font-extrabold">{lang}</span>)
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-border/50">
                            {filteredData.map((row, idx) => (
                                <tr
                                    key={`${row.namespacePath}-${row.key}`}
                                    className={cn(
                                        "group transition-colors hover:bg-muted/20",
                                        row.type === 'added' && "bg-emerald-500/[0.01] hover:bg-emerald-500/[0.03]",
                                        row.type === 'removed' && "bg-red-500/[0.01] hover:bg-red-500/[0.03]",
                                        row.type === 'modified' && "bg-amber-500/[0.005] hover:bg-amber-500/[0.02]"
                                    )}
                                    style={{
                                        contentVisibility: 'auto',
                                        containIntrinsicSize: '0 76px'
                                    }}
                                >
                                    <td className="p-4 text-xs font-mono text-muted-foreground align-top pt-5 pl-5 select-none opacity-60">{idx + 1}</td>

                                    <td className="p-4 align-top border-r border-border/30">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="font-mono text-[13px] font-bold text-foreground break-all tracking-tight leading-relaxed">
                                                {row.key}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 select-none font-medium">
                                                <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0 opacity-80" />
                                                <span className="truncate" title={row.namespacePath}>{row.namespacePath}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {languages.map(lang => {
                                        const cell = row.languages[lang];
                                        return (
                                            <td key={lang} className="p-4 align-top text-xs border-r border-border/30 last:border-r-0 bg-background/5">
                                                {row.type === 'added' ? (
                                                    <div className="p-3 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 rounded-lg font-sans whitespace-pre-wrap leading-relaxed shadow-sm">
                                                        {cell.newValue || <span className="italic opacity-40 select-none">(Chuỗi rỗng)</span>}
                                                    </div>
                                                ) : row.type === 'removed' ? (
                                                    <div className="p-3 bg-red-500/[0.08] text-red-800 dark:text-red-400 border border-red-500/20 rounded-lg font-sans line-through opacity-60 whitespace-pre-wrap leading-relaxed">
                                                        {cell.oldValue}
                                                    </div>
                                                ) : cell.isChanged ? (
                                                    <div className="space-y-2.5">
                                                        {/* Bản ghi cũ */}
                                                        <div className="p-2.5 bg-red-500/[0.03] text-red-700/90 border border-red-500/10 rounded-lg font-sans opacity-70 whitespace-pre-wrap line-through leading-relaxed">
                                                            {cell.oldValue || <span className="italic opacity-30 select-none">(Trống)</span>}
                                                        </div>

                                                        {/* Mũi tên indicator nhỏ gọn */}
                                                        <div className="flex justify-start pl-3 select-none">
                                                            <ArrowRight className="w-3.5 h-3.5 text-amber-500 opacity-80" />
                                                        </div>

                                                        {/* Bản ghi mới */}
                                                        <div className="p-2.5 bg-emerald-500/[0.03] text-foreground border border-emerald-500/15 rounded-lg font-sans font-medium whitespace-pre-wrap leading-relaxed shadow-sm">
                                                            {cell.newValue || <span className="italic opacity-30 select-none">(Trống)</span>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 text-muted-foreground/50 bg-muted/5 border border-border/20 rounded-lg font-sans italic whitespace-pre-wrap select-none leading-relaxed">
                                                        {cell.newValue || "---"}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* EMPTY STATE */}
                    {filteredData.length === 0 && (
                        <div className="p-24 flex flex-col items-center justify-center text-muted-foreground select-none">
                            <Search className="w-8 h-8 mb-3 opacity-30 text-muted-foreground" />
                            <p className="text-sm font-medium opacity-80">Không có thay đổi nào phù hợp với bộ lọc hiện tại.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground font-medium animate-pulse">Đang nạp cấu trúc dữ liệu...</div>}>
            <CompareContent />
        </Suspense>
    );
}