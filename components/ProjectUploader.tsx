"use client";

import { analyzeImportedFiles, commitImportData, type ConflictItem, type ImportPreviewResult } from "@/lib/import-utils";
import { Check, CheckCircle2, ChevronRight, FolderUp, GitMerge, X } from "lucide-react"; // Import thêm X
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

declare module 'react' {
    interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
        webkitdirectory?: string;
    }
}

interface ProjectUploaderProps {
    projectId: string;
    onUploadComplete: () => void;
}

export default function ProjectUploader({ projectId, onUploadComplete }: ProjectUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [langCode, setLangCode] = useState("en");

    const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
    const [isCommitting, setIsCommitting] = useState(false);

    const [resolutions, setResolutions] = useState<Record<string, 'local' | 'incoming'>>({});
    const [activeNamespace, setActiveNamespace] = useState<string | null>(null);

    const groupedConflicts = useMemo(() => {
        if (!previewResult?.pendingData?.conflicts) return {};
        const groups: Record<string, ConflictItem[]> = {};
        previewResult.pendingData.conflicts.forEach(c => {
            if (!groups[c.namespacePath]) groups[c.namespacePath] = [];
            groups[c.namespacePath].push(c);
        });
        return groups;
    }, [previewResult]);

    const namespaceList = useMemo(() => Object.keys(groupedConflicts), [groupedConflicts]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        setIsUploading(true);
        const toastId = toast.loading("Đang phân tích dữ liệu...");
        try {
            const result = await analyzeImportedFiles(projectId, langCode, acceptedFiles);
            toast.dismiss(toastId);
            if (result.importedCount === 0) {
                toast.error("Không tìm thấy dữ liệu hợp lệ!");
                return;
            }
            setResolutions({});
            setPreviewResult(result);
            const firstNs = Object.keys(result.pendingData?.conflicts.reduce((acc, c) => ({ ...acc, [c.namespacePath]: true }), {}) || {})[0];
            setActiveNamespace(firstNs || null);
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi đọc file.");
        } finally { setIsUploading(false); }
    }, [projectId, langCode]);

    const handleResolve = (conflictId: string, choice: 'local' | 'incoming') => {
        setResolutions(prev => ({ ...prev, [conflictId]: choice }));
    };

    const handleCancel = () => {
        setPreviewResult(null);
        setActiveNamespace(null);
        setResolutions({});
    };

    const bulkResolveFile = (ns: string, choice: 'local' | 'incoming') => {
        const fileConflicts = groupedConflicts[ns] || [];
        const newResolutions = { ...resolutions };
        fileConflicts.forEach(c => { newResolutions[c.id] = choice; });
        setResolutions(newResolutions);
    };

    const bulkResolveAll = (choice: 'local' | 'incoming') => {
        const newResolutions: Record<string, 'local' | 'incoming'> = {};
        previewResult?.pendingData?.conflicts.forEach(c => { newResolutions[c.id] = choice; });
        setResolutions(newResolutions);
        toast.info(`Đã chọn dùng bản ${choice === 'local' ? 'Local' : 'File Import'} cho tất cả.`);
    };

    const handleConfirmImport = async () => {
        if (!previewResult?.pendingData) return;
        setIsCommitting(true);
        try {
            await commitImportData(previewResult.pendingData, resolutions);
            toast.success("Import thành công!");
            setPreviewResult(null);
            onUploadComplete();
        } catch (error) { toast.error("Lỗi khi lưu dữ liệu."); } finally { setIsCommitting(false); }
    };

    const unresolvedTotal = (previewResult?.pendingData?.conflicts.length ?? 0) - Object.keys(resolutions).length;

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 mt-4">
            <div className="flex items-center justify-between px-2">
                <label className="text-sm font-medium">Ngôn ngữ mặc định:</label>
                <select value={langCode} onChange={(e) => setLangCode(e.target.value)} className="p-1.5 border rounded-md text-sm bg-background">
                    <option value="en">English (en)</option>
                    <option value="vi">Tiếng Việt (vi)</option>
                </select>
            </div>
            <div {...getRootProps()} className={cn("flex flex-col items-center justify-center w-full min-h-[300px] border-2 border-dashed rounded-xl cursor-pointer transition-all", isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/30 hover:bg-muted/60")}>
                <input {...getInputProps()} webkitdirectory="true" />
                <FolderUp className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Thả folder locales vào đây</h3>
            </div>

            <Dialog open={!!previewResult} onOpenChange={(open) => !open && handleCancel()}>
                {/* FIX 1: Thêm [&>button.absolute]:hidden để CSS giấu đi nút X mặc định của Shadcn 
                */}
                <DialogContent className="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden [&>button.absolute]:hidden">

                    {/* FIX 2: Thiết kế lại Header nằm ngang đều đặn */}
                    <DialogHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 bg-background z-10">
                        <div className="flex flex-col gap-1 text-left">
                            <DialogTitle className="text-xl">Kiểm tra & Giải quyết Xung đột</DialogTitle>
                            <DialogDescription className="m-0">So sánh và lựa chọn phiên bản dữ liệu bạn muốn giữ lại.</DialogDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => bulkResolveAll('local')}>
                                Giữ hết Local
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => bulkResolveAll('incoming')}>
                                Dùng hết Import
                            </Button>
                            {/* Nút X custom nằm thẳng hàng, đồng bộ UI */}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 ml-2 text-muted-foreground hover:text-foreground"
                                onClick={handleCancel}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar trái */}
                        <div className="w-64 border-r bg-muted/20 flex flex-col">
                            <div className="p-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wider border-b shrink-0">Danh sách file xung đột</div>
                            <ScrollArea className="flex-1 h-full">
                                {namespaceList?.map(ns => {
                                    const conflictsInNs = groupedConflicts[ns];
                                    const resolvedInNs = conflictsInNs.filter(c => resolutions[c.id]).length;
                                    const isDone = resolvedInNs === conflictsInNs.length;

                                    return (
                                        <button
                                            key={ns}
                                            onClick={() => setActiveNamespace(ns)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 text-sm flex items-center justify-between border-b transition-colors hover:bg-muted/50",
                                                activeNamespace === ns ? "bg-background border-r-2 border-r-primary" : ""
                                            )}
                                        >
                                            <div className="flex flex-col truncate mr-2">
                                                <span className={cn("truncate font-medium", isDone && "text-muted-foreground line-through")}>{ns}</span>
                                                <span className="text-[10px] opacity-60">{resolvedInNs}/{conflictsInNs.length} đã chọn</span>
                                            </div>
                                            {isDone ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <ChevronRight className="w-4 h-4 opacity-30 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </ScrollArea>
                        </div>

                        {/* Nội dung phải */}
                        {/* FIX 3: Thêm min-h-0 để ép flexbox ko bị phình to làm hỏng cuộn */}
                        <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
                            {activeNamespace ? (
                                <>
                                    <div className="p-4 border-b flex items-center justify-between bg-muted/10 shrink-0">
                                        <h4 className="font-bold text-sm flex items-center gap-2">
                                            <GitMerge className="w-4 h-4 text-red-500" />
                                            {activeNamespace}
                                        </h4>
                                        <div className="flex gap-2">
                                            <Button size="xs" variant="outline" className="text-[10px] h-7" onClick={() => bulkResolveFile(activeNamespace, 'local')}>Dùng hết Local cho file này</Button>
                                            <Button size="xs" variant="outline" className="text-[10px] h-7" onClick={() => bulkResolveFile(activeNamespace, 'incoming')}>Dùng hết Import cho file này</Button>
                                        </div>
                                    </div>

                                    {/* FIX 4: h-full cho ScrollArea và đưa p-4 vào div con bên trong */}
                                    <ScrollArea className="flex-1 h-full">
                                        <div className="p-4 space-y-6 pb-20">
                                            {groupedConflicts?.[activeNamespace]?.map(conflict => {
                                                const choice = resolutions[conflict.id];
                                                return (
                                                    <div key={conflict.id} className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="text-[10px]">{conflict.lang}</Badge>
                                                            <code className="text-[12px] font-bold text-primary">{conflict.key}</code>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div
                                                                onClick={() => handleResolve(conflict.id, 'local')}
                                                                className={cn(
                                                                    "p-3 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden",
                                                                    choice === 'local' ? "border-green-500 bg-green-50/30" : "border-muted hover:border-muted-foreground/30"
                                                                )}
                                                            >
                                                                <div className="text-[10px] font-bold text-muted-foreground mb-1 flex justify-between">
                                                                    <span>BẢN LOCAL (Đang sửa)</span>
                                                                    {choice === 'local' && <Check className="w-3 h-3 text-green-600" />}
                                                                </div>
                                                                <div className="text-sm whitespace-pre-wrap break-all">{conflict.localValue}</div>
                                                            </div>
                                                            <div
                                                                onClick={() => handleResolve(conflict.id, 'incoming')}
                                                                className={cn(
                                                                    "p-3 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden",
                                                                    choice === 'incoming' ? "border-blue-500 bg-blue-50/30" : "border-muted hover:border-muted-foreground/30"
                                                                )}
                                                            >
                                                                <div className="text-[10px] font-bold text-muted-foreground mb-1 flex justify-between">
                                                                    <span>BẢN FILE IMPORT</span>
                                                                    {choice === 'incoming' && <Check className="w-3 h-3 text-blue-600" />}
                                                                </div>
                                                                <div className="text-sm whitespace-pre-wrap break-all">{conflict.incomingValue}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                                    <CheckCircle2 className="w-12 h-12 mb-4 opacity-10" />
                                    <p>Chọn một file bên trái để bắt đầu so sánh.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                        <div className="flex flex-1 items-center gap-4">
                            <div className="text-xs">
                                Còn <b>{unresolvedTotal}</b> xung đột chưa xử lý
                            </div>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${((previewResult?.pendingData?.conflicts.length ?? 0) - unresolvedTotal) / (previewResult?.pendingData?.conflicts.length ?? 1) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCancel}>Hủy bỏ</Button>
                            <Button onClick={handleConfirmImport} disabled={isCommitting || unresolvedTotal > 0}>
                                {unresolvedTotal > 0 ? "Vui lòng xử lý hết xung đột" : "Hoàn tất Import"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}