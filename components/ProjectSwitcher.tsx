"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronsUpDown, Check, PlusCircle, Trash2, Edit2, Eraser } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { createProject, renameProject, clearProjectData, deleteProject } from "@/lib/project-utils";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function ProjectSwitcher() {
    const { activeProjectId, setActiveProject } = useAppStore();

    const projects = useLiveQuery(() => db.projects.toArray()) || [];
    const activeProject = projects.find(p => p.id === activeProjectId);

    // State quản lý Dialogs (Dùng chung 1 state để tối ưu DOM)
    const [dialogMode, setDialogMode] = useState<'new' | 'rename' | 'clear' | 'delete' | null>(null);
    const [inputValue, setInputValue] = useState("");

    const handleAction = async () => {
        try {
            if (dialogMode === 'new') {
                if (!inputValue.trim()) return toast.error("Tên dự án không được để trống");
                const newId = await createProject(inputValue.trim(), 'en'); // Mặc định EN cho MVP
                setActiveProject(newId);
                toast.success("Tạo dự án thành công!");
            }
            else if (dialogMode === 'rename' && activeProjectId) {
                if (!inputValue.trim()) return toast.error("Tên dự án không được để trống");
                await renameProject(activeProjectId, inputValue.trim());
                toast.success("Đổi tên thành công!");
            }
            else if (dialogMode === 'clear' && activeProjectId) {
                await clearProjectData(activeProjectId);
                toast.success("Đã dọn dẹp sạch dữ liệu dự án!");
            }
            else if (dialogMode === 'delete' && activeProjectId) {
                await deleteProject(activeProjectId);
                const remaining = projects.filter(p => p.id !== activeProjectId);

                // Đổi null thành chuỗi rỗng ""
                setActiveProject(remaining.length > 0 ? remaining[0].id : "");

                toast.success("Đã xóa dự án!");
            }

            setDialogMode(null);
            setInputValue("");
        } catch (error) {
            console.error(error);
            toast.error("Có lỗi xảy ra, vui lòng thử lại.");
        }
    };

    const openDialog = (mode: typeof dialogMode, defaultText: string = "") => {
        setDialogMode(mode);
        setInputValue(defaultText);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={buttonVariants({
                        variant: "outline",
                        className: "w-60 justify-between font-semibold shadow-sm"
                    })}
                >
                    {activeProject ? activeProject.name : "Chọn dự án..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60" align="start">
                    {/* Danh sách Project */}
                    {projects.map((p) => (
                        <DropdownMenuItem
                            key={p.id}
                            onClick={() => setActiveProject(p.id)}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <span className="truncate">{p.name}</span>
                            {p.id === activeProjectId && <Check className="w-4 h-4 opacity-50" />}
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Actions cho Project hiện tại */}
                    {activeProject && (
                        <>
                            <DropdownMenuItem onClick={() => openDialog('rename', activeProject.name)} className="cursor-pointer">
                                <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                Đổi tên
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog('clear')} className="cursor-pointer text-amber-600 focus:text-amber-600">
                                <Eraser className="w-4 h-4 mr-2" />
                                Clear dữ liệu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog('delete')} className="cursor-pointer text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Xóa dự án
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    {/* Tạo mới */}
                    <DropdownMenuItem onClick={() => openDialog('new')} className="cursor-pointer font-medium text-primary">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Dự án mới...
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Unified Dialog Xử lý mọi nghiệp vụ */}
            <Dialog open={!!dialogMode} onOpenChange={(open) => !open && setDialogMode(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'new' && "Tạo dự án mới"}
                            {dialogMode === 'rename' && "Đổi tên dự án"}
                            {dialogMode === 'clear' && "Clear dữ liệu dự án"}
                            {dialogMode === 'delete' && "Xóa dự án"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'clear' && "Bạn có chắc muốn xóa toàn bộ data đã import và dịch? Hành động này không thể hoàn tác."}
                            {dialogMode === 'delete' && "Dự án và toàn bộ dữ liệu bên trong sẽ bị xóa vĩnh viễn. Không thể khôi phục!"}
                        </DialogDescription>
                    </DialogHeader>

                    {(dialogMode === 'new' || dialogMode === 'rename') && (
                        <div className="py-4">
                            <Input
                                placeholder="Tên dự án..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogMode(null)}>Hủy</Button>
                        <Button
                            variant={dialogMode === 'delete' || dialogMode === 'clear' ? "destructive" : "default"}
                            onClick={handleAction}
                        >
                            Xác nhận
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}