"use client";

import { analyzeImportedFiles, commitImportData, type ImportPreviewResult, type PendingCommitData, type PreviewRow } from "@/lib/import-utils";
import { AlertTriangle, CheckCircle2, ChevronRight, FolderUp, GitMerge, HelpCircle, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { useAppStore } from "@/app/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ImportPreviewTable from "./import-preview/ImportPreviewTable";

interface ProjectUploaderProps {
    projectId: string;
    onUploadComplete: () => void;
}

interface ActiveSections {
    added: PreviewRow[];
    updated: PreviewRow[];
    conflicted: PreviewRow[];
    deleted: PreviewRow[];
}

export default function ProjectUploader({ projectId, onUploadComplete }: ProjectUploaderProps) {
    const [langCode, setLangCode] = useState<string>("en");
    const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
    const [isCommitting, setIsCommitting] = useState<boolean>(false);
    const [activeNamespace, setActiveNamespace] = useState<string | null>(null);

    const detectedLanguagesList = useMemo<string[]>(() => {
        if (!previewResult?.pendingData?.detectedLanguages) return [];
        return Array.from(previewResult.pendingData.detectedLanguages as Set<string>).sort();
    }, [previewResult]);

    const groupedChanges = useMemo<Record<string, PreviewRow[]>>(() => {
        const rows: PreviewRow[] = previewResult?.pendingData?.previewRows || [];
        const groups: Record<string, PreviewRow[]> = {};

        rows.forEach(r => {
            if (!groups[r.namespacePath]) groups[r.namespacePath] = [];
            groups[r.namespacePath].push(r);
        });

        return groups;
    }, [previewResult]);

    const namespaceList = useMemo<string[]>(() => {
        return Object.keys(groupedChanges).sort((a, b) => a.localeCompare(b));
    }, [groupedChanges]);

    const handleCellValueChange = useCallback((rowId: string, lang: string, newValue: string) => {
        setPreviewResult(prev => {
            if (!prev || !prev.pendingData) return prev;
            const pending = prev.pendingData as PendingCommitData;

            const updatedPreviewRows = pending.previewRows.map(r => {
                if (r.id === rowId) return { ...r, values: { ...r.values, [lang]: newValue } };
                return r;
            });

            const updatedNewRows = pending.newRows.map(r => {
                if (r.id === rowId) return { ...r, values: { ...r.values, [lang]: newValue } };
                return r;
            });

            const updatedRowsToUpdate = pending.rowsToUpdate.map(r => {
                if (r.id === rowId) return { ...r, values: { ...r.values, [lang]: newValue } };
                return r;
            });

            return {
                ...prev,
                pendingData: {
                    ...pending,
                    previewRows: updatedPreviewRows,
                    newRows: updatedNewRows,
                    rowsToUpdate: updatedRowsToUpdate
                }
            };
        });
    }, []);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const toastId = toast.loading("Đang phân tích dữ liệu tệp tin...");
        try {
            const result = await analyzeImportedFiles(projectId, langCode, acceptedFiles);
            toast.dismiss(toastId);

            const pending = result.pendingData;
            const hasData = (pending?.previewRows?.length ?? 0) > 0;

            if (!hasData) {
                toast.error("Không tìm thấy nội dung bản dịch nào thay đổi so với hiện tại!");
                return;
            }

            setPreviewResult(result);

            const initialAcc: Record<string, boolean> = {};
            const sortedKeys = Object.keys(
                (result.pendingData as PendingCommitData).previewRows.reduce((acc, r) => {
                    acc[r.namespacePath] = true;
                    return acc;
                }, initialAcc)
            ).sort();

            setActiveNamespace(sortedKeys[0] || "common.json");
        } catch (error) {
            console.error(error);
            toast.error("Không thể đọc tệp văn bản.");
        }
    }, [projectId, langCode]);

    const activeSections = useMemo<ActiveSections>(() => {
        const fileRows = (activeNamespace ? groupedChanges[activeNamespace] : []) || [];
        return {
            added: fileRows.filter(r => r.status === "added"),
            updated: fileRows.filter(r => r.status === "updated"),
            conflicted: fileRows.filter(r => r.status === "conflicted"),
            deleted: fileRows.filter(r => r.status === "deleted")
        };
    }, [activeNamespace, groupedChanges]);

    const handleCancel = () => {
        setPreviewResult(null);
        setActiveNamespace(null);
    };

    const handleConfirmImport = async () => {
        if (!previewResult?.pendingData) return;
        setIsCommitting(true);
        try {
            const pending = previewResult.pendingData as PendingCommitData;
            const builtResolutions: Record<string, 'local' | 'incoming'> = {};

            pending.previewRows.forEach(row => {
                if (row.status === "updated" || row.status === "conflicted") {
                    Object.keys(row.values).forEach(lang => {
                        builtResolutions[`${row.id}_${lang}`] = 'incoming';
                    });
                }
            });

            // 1. Ghi dữ liệu import xuống IndexedDB thông qua Core Engine
            await commitImportData(pending, builtResolutions);

            // 2. CHUẨN KIẾN TRÚC: useLiveQuery tự động đồng bộ data real-time, không cần ép hàm RAM thủ công
            try {
                useAppStore.getState().setActiveVersion(null);
            } catch (e) {
                // An toàn nếu app không dùng bộ lọc phiên bản
            }

            toast.success("Cập nhật bản dịch vào không gian làm việc thành công!");
            setPreviewResult(null);
            onUploadComplete();
        } catch (error) {
            console.error("Lỗi trong quá trình thực thi commit import:", error);
            toast.error("Gặp lỗi trong quá trình lưu dữ liệu bản dịch.");
        } finally {
            setIsCommitting(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 mt-4">
            <div className="flex items-center justify-between px-2">
                <label className="text-sm font-medium text-muted-foreground">Ngôn ngữ chính khi kiểm tra:</label>
                <select
                    value={langCode}
                    onChange={(e) => setLangCode(e.target.value)}
                    className="p-1.5 border rounded-md text-sm bg-background"
                >
                    <option value="en">English (en)</option>
                    <option value="vi">Tiếng Việt (vi)</option>
                </select>
            </div>
            <div {...getRootProps()} className={cn("flex flex-col items-center justify-center w-full min-h-[300px] border-2 border-dashed rounded-xl cursor-pointer transition-all", isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/30 hover:bg-muted/60")}>
                <input {...getInputProps()} {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} />
                <FolderUp className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground/80">Kéo thả hoặc nhấn để chọn Thư mục chứa các tệp bản dịch</h3>
                <p className="text-xs text-muted-foreground mt-2">Hệ thống chấp nhận cấu trúc thư mục chứa các file ngôn ngữ dạng .json hoặc .js</p>
            </div>

            <Dialog open={!!previewResult} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="w-full sm:max-w-[95vw] lg:max-w-[90vw] xl:max-w-[85vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden [&>button.absolute]:hidden">
                    <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-background z-10">
                        <div className="flex flex-col gap-1 text-left">
                            <DialogTitle className="text-xl font-bold text-foreground">Xem trước nội dung thay đổi bản dịch</DialogTitle>
                            <DialogDescription className="m-0 text-xs text-muted-foreground">Dưới đây là danh sách phân tách các mục dịch mới hoặc mục sửa đổi từ tệp tin hệ thống nhận diện được.</DialogDescription>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleCancel}>
                            <X className="w-4 h-4" />
                        </Button>
                    </DialogHeader>

                    <div className="flex flex-1 overflow-hidden">
                        {/* SIDEBAR FILE */}
                        <div className="w-80 border-r bg-muted/20 flex flex-col shrink-0">
                            <div className="p-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wider border-b shrink-0 select-none">
                                Danh sách tệp bản dịch
                            </div>
                            <ScrollArea className="flex-1 h-full">
                                {namespaceList.map(ns => {
                                    const changesInNs = groupedChanges[ns] || [];

                                    // Tính toán nhanh số lượng biến động theo từng loại trạng thái trong file này
                                    const addedCount = changesInNs.filter(r => r.status === "added").length;
                                    const updatedCount = changesInNs.filter(r => r.status === "updated").length;
                                    const conflictedCount = changesInNs.filter(r => r.status === "conflicted").length;
                                    const deletedCount = changesInNs.filter(r => r.status === "deleted").length;

                                    return (
                                        <button
                                            key={ns}
                                            onClick={() => setActiveNamespace(ns)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 text-sm flex items-center justify-between border-b transition-colors hover:bg-muted/50 group/btn",
                                                activeNamespace === ns ? "bg-background border-r-2 border-r-primary" : ""
                                            )}
                                        >
                                            <div className="flex flex-col truncate mr-2 w-full">
                                                {/* Tên File Json/Js */}
                                                <span className="truncate font-semibold text-foreground/90 group-hover/btn:text-primary transition-colors">
                                                    {ns}
                                                </span>

                                                {/* Chỉ số phụ hiển thị biến động nhỏ (+10, ~2) */}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-medium text-muted-foreground">
                                                    {addedCount > 0 && (
                                                        <span className="text-green-600 dark:text-green-500 font-bold">
                                                            +{addedCount} new
                                                        </span>
                                                    )}
                                                    {updatedCount > 0 && (
                                                        <span className="text-blue-600 dark:text-blue-500 font-bold">
                                                            ~{updatedCount} upd
                                                        </span>
                                                    )}
                                                    {conflictedCount > 0 && (
                                                        <span className="text-amber-600 dark:text-amber-500 font-bold bg-amber-500/10 px-1 rounded">
                                                            ⚠️ {conflictedCount} conf
                                                        </span>
                                                    )}
                                                    {deletedCount > 0 && (
                                                        <span className="text-red-600 dark:text-red-500 font-bold line-through decoration-red-500/50">
                                                            -{deletedCount} del
                                                        </span>
                                                    )}
                                                    {addedCount === 0 && updatedCount === 0 && conflictedCount === 0 && deletedCount === 0 && (
                                                        <span className="text-muted-foreground/40 italic">Không thay đổi</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className={cn(
                                                "w-4 h-4 opacity-20 shrink-0 group-hover/btn:opacity-60 group-hover/btn:translate-x-0.5 transition-all",
                                                activeNamespace === ns ? "opacity-60 text-primary" : ""
                                            )} />
                                        </button>
                                    );
                                })}
                            </ScrollArea>
                        </div>

                        {/* KHUNG BẢNG SPREADSHEET CHÍNH TÍCH HỢP INLINE EDIT */}
                        <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
                            {activeNamespace ? (
                                <ScrollArea className="flex-1 h-full">
                                    <div className="p-4 space-y-8 pb-20">
                                        <div className="p-2.5 bg-muted/30 border rounded-lg text-sm font-bold flex items-center gap-2 text-foreground/80 shrink-0">
                                            <GitMerge className="w-4 h-4 text-primary" />
                                            Tệp đang xem: {activeNamespace}
                                        </div>

                                        {/* PHÂN KHU 1: ADDED SECTIONS */}
                                        {activeSections.added.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                                                    <Sparkles className="w-4 h-4 text-green-600" />
                                                    Từ khóa mới thêm tinh ({activeSections.added.length})
                                                </div>
                                                <ImportPreviewTable rows={activeSections.added} languages={detectedLanguagesList} onCellValueChange={handleCellValueChange} />
                                            </div>
                                        )}

                                        {/* PHÂN KHU 2: UPDATED SECTIONS */}
                                        {activeSections.updated.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                                                    <GitMerge className="w-4 h-4 text-blue-600" />
                                                    Từ khóa có sự cập nhật an toàn ({activeSections.updated.length})
                                                </div>
                                                <ImportPreviewTable rows={activeSections.updated} languages={detectedLanguagesList} onCellValueChange={handleCellValueChange} />
                                            </div>
                                        )}

                                        {/* PHÂN KHU 3: CONFLICTED SECTIONS */}
                                        {activeSections.conflicted.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                    Từ khóa có sự xung đột văn bản ({activeSections.conflicted.length})
                                                </div>
                                                <ImportPreviewTable rows={activeSections.conflicted} languages={detectedLanguagesList} onCellValueChange={handleCellValueChange} />
                                            </div>
                                        )}

                                        {/* PHÂN KHU 4: DELETED SECTIONS */}
                                        {activeSections.deleted.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                    Từ khóa bị lược xóa khỏi tệp ({activeSections.deleted.length})
                                                </div>
                                                <ImportPreviewTable rows={activeSections.deleted} languages={detectedLanguagesList} onCellValueChange={() => { }} />
                                            </div>
                                        )}

                                    </div>
                                </ScrollArea>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                                    <HelpCircle className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="text-sm">Vui lòng chọn một tệp bản dịch bên danh sách trái để xem chi tiết.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                        <div className="flex-1 text-xs text-green-600 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Phát hiện nội dung tệp bản dịch mới sẵn sàng cập nhật vào không gian làm việc.
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCancel}>Hủy bỏ</Button>
                            <Button onClick={handleConfirmImport} disabled={isCommitting}>
                                Cập nhật vào Bảng dịch
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}