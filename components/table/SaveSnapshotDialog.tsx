"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
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
    hasChanges: boolean; // Dùng để disable nút nếu không có gì thay đổi
}

export function SaveSnapshotDialog({ projectId, hasChanges }: SaveSnapshotDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Vui lòng nhập tên phiên bản!");
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading("Đang lưu Snapshot...");

        try {
            await createSnapshot(projectId, name.trim(), description.trim());

            toast.success("Đã lưu phiên bản thành công!", { id: toastId });
            setOpen(false); // Đóng modal
            setName(""); // Reset form
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
                    className: "gap-2"
                })}
                disabled={!hasChanges}
            >
                <Save className="w-4 h-4" />
                Lưu Snapshot
            </DialogTrigger>
            <DialogContent className="sm:max-w-106.25">
                <DialogHeader>
                    <DialogTitle>Lưu phiên bản dịch (Snapshot)</DialogTitle>
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
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Hủy
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Xác nhận lưu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}