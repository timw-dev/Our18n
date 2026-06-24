"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronsUpDown, Check, PlusCircle, Trash2, Edit2, Eraser } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";
import { useSpreadsheetInteractionLock } from "@/hooks/useSpreadsheetInteractionLock";
// Import hàm clearProjectData mới từ utils vào đây
import { createProject, renameProject, deleteProject, clearProjectData } from "@/lib/project-utils";

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

    const [dialogMode, setDialogMode] = useState<'new' | 'rename' | 'clear' | 'delete' | null>(null);
    const [inputValue, setInputValue] = useState("");
    const commitActiveEdit = useSpreadsheetStore((state) => state.commitActiveEdit);
    useSpreadsheetInteractionLock("project-dialog", dialogMode !== null);

    const switchProject = async (projectId: string) => {
        const committed = await commitActiveEdit();
        if (!committed) {
            toast.error("Không thể đổi dự án vì ô đang sửa chưa được lưu.");
            return;
        }
        setActiveProject(projectId);
    };

    const handleAction = async () => {
        try {
            const committed = await commitActiveEdit();
            if (!committed) {
                toast.error("Không thể tiếp tục vì ô đang sửa chưa được lưu.");
                return;
            }
            if (dialogMode === 'new') {
                if (!inputValue.trim()) return toast.error("Tên không được để trống");
                const newId = await createProject(inputValue.trim(), 'en');
                setActiveProject(newId);
                toast.success("Tạo không gian làm việc mới thành công!");
            }
            else if (dialogMode === 'rename' && activeProjectId) {
                if (!inputValue.trim()) return toast.error("Tên không được để trống");
                await renameProject(activeProjectId, inputValue.trim());
                toast.success("Đổi tên thành công!");
            }
            // Gọi qua tầng core utils xử lý db, UI không can thiệp logic dữ liệu sâu
            else if (dialogMode === 'clear' && activeProjectId) {
                await clearProjectData(activeProjectId);
                toast.success("Đã xóa sạch toàn bộ nội dung bản dịch của dự án này!");
            }
            else if (dialogMode === 'delete' && activeProjectId) {
                await deleteProject(activeProjectId);
                const remaining = projects.filter(p => p.id !== activeProjectId);
                setActiveProject(remaining.length > 0 ? remaining[0].id : "");
                toast.success("Đã xóa dự án thành công!");
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
                    {projects.map((p) => (
                        <DropdownMenuItem
                            key={p.id}
                            onClick={() => { void switchProject(p.id); }}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <span className="truncate">{p.name}</span>
                            {p.id === activeProjectId && <Check className="w-4 h-4 opacity-50" />}
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {activeProject && (
                        <>
                            <DropdownMenuItem onClick={() => openDialog('rename', activeProject.name)} className="cursor-pointer">
                                <Edit2 className="w-4 h-4 mr-2 text-muted-foreground" />
                                Đổi tên dự án
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog('clear')} className="cursor-pointer text-amber-600 focus:text-amber-600">
                                <Eraser className="w-4 h-4 mr-2" />
                                Xóa sạch nội dung dịch
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog('delete')} className="cursor-pointer text-red-600 focus:text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Xóa bỏ dự án này
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}

                    <DropdownMenuItem onClick={() => openDialog('new')} className="cursor-pointer font-medium text-primary">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Tạo dự án mới...
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={!!dialogMode} onOpenChange={(open) => !open && setDialogMode(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'new' && "Tạo không gian dự án mới"}
                            {dialogMode === 'rename' && "Đổi tên dự án"}
                            {dialogMode === 'clear' && "Xóa toàn bộ nội dung dịch thuật"}
                            {dialogMode === 'delete' && "Xóa bỏ hoàn toàn dự án"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'clear' && "Hành động này sẽ làm trống toàn bộ bảng dịch hiện tại, bao gồm cả nội dung đã nhập và lịch sử sao lưu. Bạn vẫn giữ lại tên dự án này để tải lên tệp tin mới từ đầu."}
                            {dialogMode === 'delete' && "Toàn bộ tên dự án, danh sách ngôn ngữ và nội dung dịch bên trong sẽ bị xóa vĩnh viễn khỏi hệ thống. Không thể khôi phục lại."}
                        </DialogDescription>
                    </DialogHeader>

                    {(dialogMode === 'new' || dialogMode === 'rename') && (
                        <div className="py-4">
                            <Input
                                placeholder="Nhập tên dự án..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogMode(null)}>Hủy bỏ</Button>
                        <Button
                            variant={dialogMode === 'delete' || dialogMode === 'clear' ? "destructive" : "default"}
                            onClick={handleAction}
                        >
                            Xác nhận xóa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
