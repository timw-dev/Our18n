"use client";

import { analyzeImportedFiles, commitImportData, type ImportPreviewResult, type PendingCommitData, type PreviewRow } from "@/lib/import-utils";
import { AlertTriangle, CheckCircle2, ChevronRight, FolderUp, HelpCircle, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ImportPreviewTable from "./import-preview/ImportPreviewTable";
import { useSpreadsheetInteractionLock } from "@/hooks/useSpreadsheetInteractionLock";

interface ProjectUploaderProps {
    projectId: string;
    onUploadComplete: () => void;
}

export default function ProjectUploader({ projectId, onUploadComplete }: ProjectUploaderProps) {
    const [langCode, setLangCode] = useState<string>("en");
    const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
    const [isCommitting, setIsCommitting] = useState<boolean>(false);
    const [activeNamespace, setActiveNamespace] = useState<string | null>(null);
    const [currentFilterTab, setCurrentFilterTab] = useState<"all" | "added" | "updated" | "conflicted">("all");
    const [conflictResolutions, setConflictResolutions] = useState<Record<string, "local" | "incoming">>({});
    useSpreadsheetInteractionLock("import-preview", previewResult !== null);

    const detectedLanguagesList = useMemo<string[]>(() => {
        if (!previewResult?.pendingData?.detectedLanguages) return [];
        return Array.from(previewResult.pendingData.detectedLanguages as Set<string>).sort();
    }, [previewResult]);

    const handleResolveConflict = useCallback((rowId: string, lang: string, choice: "local" | "incoming") => {
        setConflictResolutions(prev => ({
            ...prev,
            [`${rowId}_${lang}`]: choice
        }));
    }, []);

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
        // FIX BUG 1: Chặn đứng luồng xử lý từ vòng gửi xe nếu không tìm thấy projectId hợp lệ
        if (!projectId) {
            toast.error("Vui lòng chọn hoặc khởi tạo một Không gian làm việc (Project) trước khi nạp tệp bản dịch!");
            return;
        }

        if (acceptedFiles.length === 0) return;
        const toastId = toast.loading("Đang phân tích dữ liệu tệp tin...");
        try {
            const result = await analyzeImportedFiles(projectId, langCode, acceptedFiles);
            toast.dismiss(toastId);

            // Bổ sung hiển thị danh sách cảnh báo nếu bộ lọc phát hiện file tiếng lạ
            if (result.warnings.length > 0) {
                result.warnings.forEach(warn => console.warn("Import Warning:", warn));
                if (result.importedCount === 0) {
                    toast.error("Toàn bộ tệp bản dịch bị từ chối do không khớp ngôn ngữ của Project hiện hành.");
                    return;
                }
            }

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
            setCurrentFilterTab("all");
        } catch (error) {
            console.error(error);
            toast.error("Không thể đọc tệp văn bản.");
        }
    }, [projectId, langCode]);

    const handleCancel = () => {
        setPreviewResult(null);
        setActiveNamespace(null);
        setConflictResolutions({});
    };

    const handleConfirmImport = async () => {
        if (!previewResult?.pendingData) return;
        setIsCommitting(true);
        try {
            const pending = previewResult.pendingData as PendingCommitData;
            const builtResolutions: Record<string, 'local' | 'incoming'> = {};

            pending.previewRows.forEach(row => {
                Object.keys(row.values).forEach(lang => {
                    const key = `${row.id}_${lang}`;
                    if (row.status === "conflicted") {
                        builtResolutions[key] = conflictResolutions[key] || 'incoming';
                    } else if (row.status === "updated") {
                        builtResolutions[key] = 'incoming';
                    }
                });
            });

            await commitImportData(pending, builtResolutions);

            toast.success("Cập nhật bản dịch vào không gian làm việc thành công!");
            setPreviewResult(null);
            setConflictResolutions({});
            onUploadComplete();
        } catch (error) {
            console.error("Lỗi trong quá trình thực thi commit import:", error);
            toast.error("Gặp lỗi trong quá trình lưu dữ liệu bản dịch.");
        } finally {
            setIsCommitting(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
    const filteredPreviewRows = useMemo(() => {
        const fileRows = (activeNamespace ? groupedChanges[activeNamespace] : []) || [];
        if (currentFilterTab === "all") return fileRows;
        return fileRows.filter(r => r.status === currentFilterTab);
    }, [activeNamespace, groupedChanges, currentFilterTab]);

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
                        {/* SIDEBAR FILE - FIX BUG 4: border-r nằm ở container cha, ScrollArea nằm lọt lòng */}
                        <div className="w-80 border-r border-muted bg-muted/20 flex flex-col shrink-0 overflow-hidden">
                            {/* FIX BUG 4: h-[49px] py-[13px] để đồng nhất hoàn hảo với thanh tab bar bên cạnh */}
                            <div className="h-[49px] px-4 py-[15px] text-[11px] font-bold uppercase text-muted-foreground tracking-wider border-b bg-muted/10 shrink-0 select-none flex items-center">
                                Danh sách tệp bản dịch
                            </div>
                            <ScrollArea className="flex-1 h-full">
                                <div className="pb-10">
                                    {namespaceList.map(ns => {
                                        const changesInNs = groupedChanges[ns] || [];
                                        const addedCount = changesInNs.filter(r => r.status === "added").length;
                                        const updatedCount = changesInNs.filter(r => r.status === "updated").length;
                                        const conflictedCount = changesInNs.filter(r => r.status === "conflicted").length;
                                        const deletedCount = changesInNs.filter(r => r.status === "deleted").length;

                                        return (
                                            <button
                                                type="button"
                                                key={ns}
                                                onClick={() => setActiveNamespace(ns)}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 text-sm flex items-center justify-between border-b transition-colors hover:bg-muted/50 group/btn",
                                                    activeNamespace === ns ? "bg-background border-r-2 border-r-primary" : ""
                                                )}
                                            >
                                                <div className="flex flex-col truncate mr-2 w-full">
                                                    <span className="truncate font-semibold text-foreground/90 group-hover/btn:text-primary transition-colors">
                                                        {ns}
                                                    </span>

                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-medium text-muted-foreground">
                                                        {addedCount > 0 && <span className="text-green-600 dark:text-green-500 font-bold">+{addedCount} new</span>}
                                                        {updatedCount > 0 && <span className="text-blue-600 dark:text-blue-500 font-bold">~{updatedCount} upd</span>}
                                                        {conflictedCount > 0 && <span className="text-amber-600 dark:text-amber-500 font-bold bg-amber-500/10 px-1 rounded">⚠️ {conflictedCount} conf</span>}
                                                        {deletedCount > 0 && <span className="text-red-600 dark:text-red-500 font-bold line-through">-{deletedCount} del</span>}
                                                        {addedCount === 0 && updatedCount === 0 && conflictedCount === 0 && deletedCount === 0 && <span className="text-muted-foreground/40 italic">Không thay đổi</span>}
                                                    </div>
                                                </div>
                                                <ChevronRight className={cn("w-4 h-4 opacity-20 shrink-0 group-hover/btn:opacity-60 group-hover/btn:translate-x-0.5 transition-all", activeNamespace === ns ? "opacity-60 text-primary" : "")} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* KHUNG BẢNG SPREADSHEET CHÍNH TÍCH HỢP INLINE EDIT */}
                        <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
                            {activeNamespace ? (
                                <div className="flex flex-col h-full overflow-hidden">
                                    {/* THANH ĐIỀU HƯỚNG TABS BỘ LỌC TẬP TRUNG */}
                                    <div className="h-[49px] px-4 py-2 border-b bg-muted/10 flex items-center justify-between shrink-0 select-none">
                                        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentFilterTab("all")}
                                                className={cn("px-3 py-1 rounded-md font-medium transition-all", currentFilterTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Tất cả ({groupedChanges[activeNamespace]?.length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentFilterTab("added")}
                                                className={cn("px-3 py-1 rounded-md font-medium transition-all", currentFilterTab === "added" ? "bg-background text-green-600 shadow-sm font-bold" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Mới ({groupedChanges[activeNamespace]?.filter(r => r.status === "added").length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentFilterTab("updated")}
                                                className={cn("px-3 py-1 rounded-md font-medium transition-all", currentFilterTab === "updated" ? "bg-background text-blue-600 shadow-sm font-bold" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Cập nhật ({groupedChanges[activeNamespace]?.filter(r => r.status === "updated").length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentFilterTab("conflicted")}
                                                className={cn("px-3 py-1 rounded-md font-medium transition-all", currentFilterTab === "conflicted" ? "bg-background text-amber-600 shadow-sm font-bold" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Xung đột ({groupedChanges[activeNamespace]?.filter(r => r.status === "conflicted").length || 0})
                                            </button>
                                        </div>

                                        {/* BỘ NÚT XỬ LÝ NHANH CHO CÁC Ô XUNG ĐỘT TRONG FILE */}
                                        {groupedChanges[activeNamespace]?.some(r => r.status === "conflicted") && (
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-7 py-0 px-2.5 text-[11px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                                                    onClick={() => {
                                                        const newRes = { ...conflictResolutions };
                                                        (groupedChanges[activeNamespace] || []).filter(r => r.status === "conflicted").forEach(row => {
                                                            detectedLanguagesList.forEach(lang => {
                                                                if ((row.localValues?.[lang] || "") !== (row.values[lang] || "")) {
                                                                    newRes[`${row.id}_${lang}`] = "local";
                                                                }
                                                            });
                                                        });
                                                        setConflictResolutions(newRes);
                                                        toast.success("Đã chọn: Giữ lại toàn bộ bản cũ trên máy");
                                                    }}
                                                >
                                                    🛡️ Giữ tất cả Local
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="h-7 py-0 px-2.5 text-[11px] bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => {
                                                        const newRes = { ...conflictResolutions };
                                                        (groupedChanges[activeNamespace] || []).filter(r => r.status === "conflicted").forEach(row => {
                                                            detectedLanguagesList.forEach(lang => {
                                                                if ((row.localValues?.[lang] || "") !== (row.values[lang] || "")) {
                                                                    newRes[`${row.id}_${lang}`] = "incoming";
                                                                }
                                                            });
                                                        });
                                                        setConflictResolutions(newRes);
                                                        toast.success("Đã chọn: Ghi đè toàn bộ bằng bản mới");
                                                    }}
                                                >
                                                    📥 Lấy tất cả Incoming
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* BẢNG SPREADSHEET ĐƠN DUY NHẤT ĐƯỢC TỐI ƯU HÓA */}
                                    <ScrollArea className="flex-1 h-full p-4">
                                        {filteredPreviewRows.length > 0 ? (
                                            <div className="pb-24">
                                                <ImportPreviewTable
                                                    rows={filteredPreviewRows}
                                                    languages={detectedLanguagesList}
                                                    onCellValueChange={handleCellValueChange}
                                                    onResolveConflict={handleResolveConflict}
                                                    resolutions={conflictResolutions}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-muted-foreground p-16 text-center select-none">
                                                <HelpCircle className="w-10 h-10 mb-3 opacity-20" />
                                                <p className="text-xs">Không tìm thấy từ khóa nào thuộc bộ lọc này.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
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
