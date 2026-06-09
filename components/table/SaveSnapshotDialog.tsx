/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, History } from "lucide-react";
import { toast } from "sonner";

import { createSnapshot } from "@/lib/snapshot-utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface SaveSnapshotDialogProps {
    projectId: string;
    hasChanges: boolean;
}

export function SaveSnapshotDialog({ projectId, hasChanges }: SaveSnapshotDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!open) {
            setName("");
            setDescription("");
            setIsSaving(false);
        }
    }, [open]);

    // THAY ĐỔI: Bổ sung e: React.FormEvent để xử lý form submit
    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault(); // Ngăn trình duyệt reload trang

        if (!name.trim()) {
            toast.error("Vui lòng nhập tên phiên bản!");
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading("Đang lưu Snapshot...");

        try {
            const result = await createSnapshot(projectId, name.trim(), description.trim());

            toast.success(`Đã chốt phiên bản ${result.version} (${result.changeCount} thay đổi)!`, { id: toastId });
            setOpen(false);
            setName("");
            setDescription("");
        } catch (error) {
            console.error(error);
            toast.error("Có lỗi xảy ra khi lưu phiên bản.", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                className={buttonVariants({
                    variant: hasChanges ? "default" : "secondary",
                    className: "gap-2 relative"
                })}
                disabled={!hasChanges}
            >
                <Save className="w-4 h-4" />
                Lưu Snapshot
                {hasChanges && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                {/* THAY ĐỔI: Bọc toàn bộ Header, Body, Footer vào một Form */}
                <form onSubmit={handleSave}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            Lưu phiên bản dịch (Snapshot)
                        </DialogTitle>
                        <DialogDescription>
                            Hành động này sẽ chốt toàn bộ các bản dịch bạn vừa sửa thành bản gốc, giúp bạn dễ dàng khôi phục lại nếu có sai sót sau này.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Tên <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="VD: Dịch xong trang Admin..."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="description" className="text-right pt-2">
                                Mô tả
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Ghi chú thêm (Tùy chọn)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3 resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                            Hủy
                        </Button>
                        {/* THAY ĐỔI: Sử dụng type="submit" thay vì onClick */}
                        <Button type="submit" disabled={isSaving || !name.trim()}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Xác nhận lưu
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}