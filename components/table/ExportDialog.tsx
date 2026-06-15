/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { Download, Loader2, FolderArchive, Folder, Eye } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ExportDialogProps {
    allLanguages: string[];
    visibleLanguages: string[];
    isExporting: boolean;
    isTableEmpty: boolean;
    onExport: (selectedLangs: string[]) => Promise<void>;
}

export function ExportDialog({
    allLanguages,
    visibleLanguages,
    isExporting,
    isTableEmpty,
    onExport,
}: ExportDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            setSelectedLangs(visibleLanguages.length > 0 ? visibleLanguages : allLanguages);
        }
    }, [open, visibleLanguages, allLanguages]);

    const handleToggleLang = (lang: string) => {
        setSelectedLangs((prev) =>
            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
        );
    };

    const handleSelectAll = () => setSelectedLangs(allLanguages);
    const handleSelectVisible = () => setSelectedLangs(visibleLanguages);

    const handleSubmit = async () => {
        if (selectedLangs.length === 0) return;
        await onExport(selectedLangs);
        setOpen(false);
    };

    // ==========================================
    // LOGIC TÍNH TOÁN TRẠNG THÁI ACTIVE CHO TABS
    // ==========================================
    const isAllSelected = selectedLangs.length === allLanguages.length;
    const isVisibleSelected = selectedLangs.length === visibleLanguages.length && visibleLanguages.every(l => selectedLangs.includes(l));

    // Nếu all = visible thì ưu tiên sáng đèn nút "Chọn tất cả" thôi
    const isOnlyVisibleActive = isVisibleSelected && !isAllSelected;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                disabled={isTableEmpty || isExporting}
                className={cn(
                    buttonVariants({ variant: "outline" }),
                    "gap-2 shadow-sm bg-background cursor-pointer outline-none"
                )}
            >
                <Download className="w-4 h-4" />
                Export ZIP
            </DialogTrigger>

            <DialogContent className="sm:max-w-[480px] p-6 gap-5 rounded-xl border bg-background shadow-lg">
                <DialogHeader className="gap-1.5">
                    <DialogTitle className="text-xl font-bold tracking-tight">Tùy chọn xuất bản dịch (Export)</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                        Chọn các cột ngôn ngữ bạn muốn đóng gói vào file ZIP.
                    </DialogDescription>
                </DialogHeader>

                {/* BỘ NÚT TAB THÔNG MINH - HIỂN THỊ ACTIVE RÕ RÀNG */}
                <div className="flex items-center gap-1 py-1.5 px-1.5 rounded-lg bg-muted/40 border border-muted/50 w-fit">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "text-xs h-8 font-medium px-3 gap-1.5 rounded-md transition-all",
                            isAllSelected
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={handleSelectAll}
                    >

                        Chọn tất cả
                    </Button>
                    <div className="w-[1px] h-4 bg-muted-foreground/20 mx-1" />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "text-xs h-8 font-medium px-3 gap-1.5 rounded-md transition-all",
                            isOnlyVisibleActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={handleSelectVisible}
                    >

                        Chỉ cột đang hiện
                    </Button>
                </div>

                <div className="grid grid-cols-[1fr_160px] gap-4 items-start">
                    {/* CỘT TRÁI: DANH SÁCH CHECKBOX */}
                    <div className="flex flex-col gap-1 max-h-[160px] overflow-auto pr-2">
                        {allLanguages.map((lang) => {
                            const isVisible = visibleLanguages.includes(lang);
                            const isChecked = selectedLangs.includes(lang);

                            return (
                                <div
                                    key={lang}
                                    onClick={() => handleToggleLang(lang)}
                                    className={cn(
                                        "flex items-center space-x-3 py-2 px-3 mx-0.5 rounded-md cursor-pointer transition-all select-none border border-transparent",
                                        isChecked ? "bg-primary/[0.04] border-primary/10" : "hover:bg-muted/40"
                                    )}
                                >
                                    <Checkbox
                                        id={`export-lang-${lang}`}
                                        checked={isChecked}
                                        onCheckedChange={() => { }} // Đã xử lý ở thẻ cha để tăng vùng click
                                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/40 w-4 h-4 rounded pointer-events-none"
                                    />
                                    <Label
                                        htmlFor={`export-lang-${lang}`}
                                        className="flex-1 font-mono font-bold text-[13px] flex items-center justify-between pointer-events-none"
                                    >
                                        <span className={cn(isChecked ? "text-foreground" : "text-muted-foreground")}>
                                            {lang.toUpperCase()}
                                        </span>
                                        {!isVisible && (
                                            <Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
                                        )}
                                    </Label>
                                </div>
                            );
                        })}
                    </div>

                    {/* CỘT PHẢI: PREVIEW FILE ZIP THEO THỜI GIAN THỰC */}
                    <div className="p-3 rounded-lg border bg-muted/20 shadow-inner flex flex-col gap-2 h-full">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preview file ZIP</span>

                        {selectedLangs.length === 0 ? (
                            <span className="text-[11px] text-red-500/80 italic mt-2">Đang trống...</span>
                        ) : (
                            <div className="font-mono text-[11px] text-foreground/80 flex flex-col gap-1.5 mt-1">
                                <div className="flex items-center gap-1.5 font-bold text-foreground">
                                    <FolderArchive className="w-4 h-4 text-primary" />
                                    our18n.zip
                                </div>
                                <div className="flex flex-col gap-1 pl-4 border-l-2 border-muted-foreground/20 ml-1.5 mt-1">
                                    {selectedLangs.sort().map(lang => (
                                        <div key={lang} className="flex items-center gap-1.5 relative py-0.5">
                                            <div className="absolute -left-4 top-1/2 w-3 border-b-2 border-muted-foreground/20" />
                                            <Folder className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
                                            <span>{lang}/</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="sm:justify-end gap-2 border-t pt-4 border-muted">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isExporting} className="h-9 text-sm rounded-lg">
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isExporting || selectedLangs.length === 0}
                        className="gap-2 h-9 text-sm rounded-lg shadow-sm font-medium px-4"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Xuất file ZIP
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}