"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { db } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { Button } from "@/components/ui/button";
import ProjectUploader from "@/components/ProjectUploader";
import TranslationTable from "@/components/table/TranslationTable";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Home() {
  const { activeProjectId, setActiveProject } = useAppStore();
  const projects = useLiveQuery(() => db.projects.toArray());

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const hasData = useLiveQuery(
    () => activeProjectId ? db.namespaces.where({ projectId: activeProjectId }).count() : 0,
    [activeProjectId]
  );

  // LOGIC AUTO-SELECT: CHỈ CHẠY 1 LẦN DUY NHẤT KHI CHƯA CÓ ACTIVE PROJECT
  useEffect(() => {
    if (projects && projects.length > 0 && !activeProjectId) {
      const savedProjectId = localStorage.getItem("our18n_active_project");

      if (savedProjectId && projects.some(p => p.id === savedProjectId)) {
        setActiveProject(savedProjectId);
      } else {
        const lastUpdatedProject = [...projects].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setActiveProject(lastUpdatedProject.id);
        localStorage.setItem("our18n_active_project", lastUpdatedProject.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]); // Xóa activeProjectId khỏi dependency để chống loop

  // LOGIC LƯU CACHE MỖI KHI BẠN CHỦ ĐỘNG ĐỔI PROJECT
  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem("our18n_active_project", activeProjectId);
    }
  }, [activeProjectId]);

  return (
    <main className="h-screen overflow-hidden px-6 py-4 max-w-[1600px] mx-auto flex flex-col gap-4 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b pb-3 shrink-0">
        <div className="space-y-2 flex flex-col items-start justify-center w-full">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Our18n v0.3.3 Beta</h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Không gian làm việc quản lý tệp đa ngôn ngữ. Nhập dữ liệu, chỉnh sửa, so sánh phiên bản và xuất file trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ProjectSwitcher />
          </div>
        </div>

        {activeProjectId && hasData !== undefined && hasData > 0 && (
          <Button onClick={() => setIsImportModalOpen(true)} className="gap-2 shrink-0">
            <Upload className="w-4 h-4" />
            Import Folders
          </Button>
        )}
      </div>

      {!activeProjectId && (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed rounded-lg bg-muted/10 p-12 text-center mt-10">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tạo dự án đầu tiên</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Tạo một dự án mới, sau đó nhập các folders chứa tệp ngôn ngữ JSON hoặc JavaScript để bắt đầu làm việc.
            </p>
          </div>
        </div>
      )}

      {activeProjectId && hasData === 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-10">
          <ProjectUploader
            projectId={activeProjectId}
            onUploadComplete={() => { }}
          />
        </div>
      )}

      {activeProjectId && hasData !== undefined && hasData > 0 && (
        <div className="flex-1 w-full min-h-0 overflow-hidden">
          <TranslationTable key={activeProjectId} />
        </div>
      )}

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-4xl p-0 border-0 overflow-hidden bg-transparent shadow-none">
          <div className="bg-background p-6 rounded-xl border shadow-xl">
            <DialogHeader className="mb-4">
              <DialogTitle>Nhập tệp bản dịch bổ sung</DialogTitle>
              <DialogDescription>Kéo thả thư mục chứa ngôn ngữ mới hoặc bản cập nhật vào đây.</DialogDescription>
            </DialogHeader>

            {activeProjectId && (
              <ProjectUploader
                projectId={activeProjectId}
                onUploadComplete={() => setIsImportModalOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}