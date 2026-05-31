"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
    Check,
    Clock,
    FileText,
    GitCommit,
    GitCompare,
    History,
    Info,
    RotateCcw,
    Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useCallback, memo, useMemo } from "react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet";
import { db } from "@/lib/db";
import { deleteSnapshot, restoreSnapshot } from "@/lib/snapshot-utils";
import { cn } from "@/lib/utils";

interface VersionHistoryPanelProps {
    projectId: string;
    currentVersionName?: string; // Tên phiên bản đang xem (nếu có)
}

interface SnapshotRowData {
    id: string;
    namespaceId: string;
    key: string;
    values: Record<string, string>;
    originalValues: Record<string, string>;
    changeStatus: string;
    cellMeta?: Record<string, unknown>;
}

// Khởi tạo bộ format date bên ngoài component để tránh khởi tạo lại lãng phí bộ nhớ trên mỗi frame render
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

// --- SUB-COMPONENT: CO LẬP RE-RENDER CHO TỪNG THẺ PHIÊN BẢN ---
const VersionCard = memo(({
    v,
    isSelected,
    unsavedCount,
    onToggleSelect,
    onDelete,
    onRestore
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    v: any;
    isSelected: boolean;
    unsavedCount: number;
    onToggleSelect: (id: string) => void;
    onDelete: (id: string) => Promise<void>;
    onRestore: (id: string, name: string) => Promise<void>;
}) => {
    // Tính toán số lượng bản ghi thực tế, tối ưu hóa để không chạy lại trừ khi object `v` thay đổi
    const computedRowCount = useMemo(() => {
        if (v.snapshot && Array.isArray(v.snapshot)) {
            return v.snapshot.filter((r: SnapshotRowData) => r.changeStatus !== 'deleted').length;
        }
        return v.rowCount || 0;
    }, [v.snapshot, v.rowCount]);

    const formattedDate = useMemo(() => {
        return dateFormatter.format(new Date(v.createdAt));
    }, [v.createdAt]);

    return (
        <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background z-10 shadow-sm mt-1">
                <GitCommit className="h-5 w-5 text-primary" />
            </div>
            <div
                onClick={() => onToggleSelect(v.id)}
                className={cn(
                    "flex-1 rounded-xl border text-card-foreground shadow-sm p-4 hover:border-primary/40 transition-all group cursor-pointer relative",
                    isSelected ? "border-2 border-blue-500 bg-blue-50/30 shadow-md transform scale-[1.01]" : "bg-card hover:bg-muted/10"
                )}
            >
                {isSelected && (
                    <div className="absolute -top-2 -left-2 bg-blue-600 text-white rounded-full p-1 shadow-sm animate-in zoom-in-50 duration-150">
                        <Check className="w-3 h-3" />
                    </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="default" className="font-mono bg-primary/10 text-primary hover:bg-primary/20">v{v.version}</Badge>
                            <span className="font-semibold text-base line-clamp-1">{v.name}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <Badge variant="outline" className="text-[10px] bg-background font-medium text-muted-foreground">
                                {computedRowCount} bản ghi
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] bg-muted/50 text-muted-foreground">{v.changeCount} thay đổi</Badge>
                        </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                            <AlertDialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer")}>
                                <Trash2 className="w-4 h-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa vĩnh viễn v{v.version}?</AlertDialogTitle>
                                    <AlertDialogDescription>Hành động này không thể khôi phục.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Giữ lại</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(v.id)} className="bg-red-600 hover:bg-red-700 text-white">Xác nhận Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {v.description && (
                    <div className="text-sm text-muted-foreground mb-4 bg-muted/30 p-3 rounded-lg flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
                        <span className="whitespace-pre-wrap">{v.description}</span>
                    </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1.5 opacity-50" />
                        {formattedDate}
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer")}>
                            <RotateCcw className="w-3 h-3 mr-1.5" /> Khôi phục
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Khôi phục về {v.version}?</AlertDialogTitle>
                                <AlertDialogDescription>Ghi đè bảng làm việc hiện hành bằng dữ liệu của <b>{v.name}</b>.</AlertDialogDescription>
                                {unsavedCount > 0 && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm mt-4">
                                        ⚠️ <b>CẢNH BÁO:</b> Có <b>{unsavedCount} chỉnh sửa chưa lưu</b> sẽ bị xóa vĩnh viễn!
                                    </div>
                                )}
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onRestore(v.id, v.name)} className={unsavedCount > 0 ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}>Đồng ý</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
});
VersionCard.displayName = "VersionCard";

// --- MAIN COMPONENT ---
export function VersionHistoryPanel({ projectId, currentVersionName }: VersionHistoryPanelProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const versions = useLiveQuery(() => db.versions.where({ projectId }).reverse().sortBy('createdAt'), [projectId]);
    const unsavedCount = useLiveQuery(
        () => db.translationRows.where({ projectId }).filter(row => row.changeStatus !== 'unchanged').count(),
        [projectId]
    ) || 0;

    const handleRestoreVersion = useCallback(async (versionId: string, versionName: string) => {
        const toastId = toast.loading("Đang khôi phục dữ liệu...");
        try {
            await restoreSnapshot(projectId, versionId);
            toast.success(`Đã khôi phục thành công về bản: ${versionName}`, { id: toastId });
            setOpen(false);
        } catch (error) {
            toast.error("Lỗi khi khôi phục dữ liệu.", { id: toastId });
        }
    }, [projectId]);

    const handleDeleteVersion = useCallback(async (versionId: string) => {
        try {
            await deleteSnapshot(versionId);
            setSelectedIds(prev => prev.filter(id => id !== versionId));
            toast.success("Đã xóa vĩnh viễn phiên bản này.");
        } catch (error) {
            toast.error("Không thể xóa phiên bản.");
        }
    }, []);

    // Tối ưu hóa hàm toggle bằng useCallback để tránh render lại card không cần thiết
    const handleToggleSelectCard = useCallback((vId: string) => {
        setSelectedIds(prev => {
            if (prev.includes(vId)) return prev.filter(id => id !== vId);
            if (prev.length < 2) return [...prev, vId];
            return [prev[1], vId];
        });
    }, []);

    const handleTriggerCompare = () => {
        if (selectedIds.length !== 2 || !versions) return;
        const itemA = versions.find(v => v.id === selectedIds[0]);
        const itemB = versions.find(v => v.id === selectedIds[1]);

        if (!itemA || !itemB) return;

        const timeA = new Date(itemA.createdAt).getTime();
        const timeB = new Date(itemB.createdAt).getTime();

        const baseId = timeA < timeB ? itemA.id : itemB.id;
        const targetId = timeA < timeB ? itemB.id : itemA.id;

        setOpen(false);
        router.push(`/compare?projectId=${projectId}&base=${baseId}&target=${targetId}`);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={buttonVariants({
                variant: currentVersionName ? "secondary" : "outline", className: cn(
                    "gap-2 text-muted-foreground hover:text-foreground cursor-pointer font-medium shadow-sm",
                    currentVersionName && "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20"
                )
            })}>
                <History className={cn("w-4 h-4", currentVersionName && "text-blue-500")} />
                {currentVersionName ? `Bản xem: ${currentVersionName}` : "Lịch sử"}
            </SheetTrigger>

            <SheetContent className="w-full flex flex-col p-0 overflow-hidden data-[side=right]:sm:max-w-[600px] data-[side=right]:lg:max-w-[750px]">
                <SheetHeader className="shrink-0 p-6 border-b bg-muted/5">
                    <SheetTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" /> Lịch sử Phiên bản
                    </SheetTitle>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md flex items-start gap-3 text-sm text-blue-800">
                        <Info className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                        <p><b>Tính năng Code Review:</b> Tích chọn <b>2 thẻ phiên bản</b> bên dưới và bấm nút So sánh để xem chi tiết.</p>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="p-6 pb-28">
                        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-muted/50">
                            {!versions || versions.length === 0 ? (
                                <div className="text-center text-muted-foreground py-12 bg-background relative z-10">Chưa có phiên bản nào được lưu.</div>
                            ) : (
                                versions.map((v) => (
                                    <VersionCard
                                        key={v.id}
                                        v={v}
                                        isSelected={selectedIds.includes(v.id)}
                                        unsavedCount={unsavedCount}
                                        onToggleSelect={handleToggleSelectCard}
                                        onDelete={handleDeleteVersion}
                                        onRestore={handleRestoreVersion}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="absolute bottom-0 inset-x-0 p-4 border-t bg-background/95 backdrop-blur-md flex justify-center shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-20">
                    <Button
                        disabled={selectedIds.length !== 2}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer h-12 text-sm shadow-md disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none transition-all"
                        onClick={handleTriggerCompare}
                    >
                        <GitCompare className="w-5 h-5" />
                        {selectedIds.length === 2 ? "Tiến hành So sánh 2 phiên bản" : `Chọn 2 phiên bản để so sánh (${selectedIds.length}/2)`}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}