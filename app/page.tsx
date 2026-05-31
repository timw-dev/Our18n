"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Upload } from "lucide-react";
import { useEffect } from "react";

import { db } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { Button } from "@/components/ui/button";
import ProjectUploader from "@/components/ProjectUploader";
import TranslationTable from "@/components/table/TranslationTable";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";

export default function Home() {
  // Lấy thêm hàm setActiveProject từ store
  const { activeProjectId, setActiveProject } = useAppStore();

  // Load danh sách projects để phục vụ auto-select
  const projects = useLiveQuery(() => db.projects.toArray());

  // Đếm số lượng namespace để biết Project này "có data" hay "rỗng"
  const hasData = useLiveQuery(
    () => activeProjectId ? db.namespaces.where({ projectId: activeProjectId }).count() : 0,
    [activeProjectId]
  );

  // LOGIC AUTO-SELECT: Tự động chọn project làm việc gần nhất khi reload trang
  useEffect(() => {
    if (projects && projects.length > 0 && !activeProjectId) {
      // Sắp xếp giảm dần theo thời gian update
      const lastUpdatedProject = [...projects].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];

      setActiveProject(lastUpdatedProject.id);
    }
  }, [projects, activeProjectId, setActiveProject]);

  return (
    <main className="min-h-screen p-8 md:p-12 max-w-400 mx-auto flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b pb-4">
        <div className="space-y-4 flex flex-col items-center justify-center w-full text-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Our18n v0.2.0 beta - I18n For Our Translator</h1>
            <p className="text-muted-foreground">
              Quản lý và chỉnh sửa tệp ngôn ngữ hoàn toàn offline.
            </p>
          </div>

          {/* KHU VỰC PROJECT SWITCHER (Chỉ hiển thị khi đã load xong DB) */}
          <div className="flex items-center gap-4">
            <ProjectSwitcher />
          </div>
        </div>

        {/* NÚT IMPORT: Chỉ hiển thị khi có Project ĐÃ CÓ DATA */}
        {activeProjectId && hasData !== undefined && hasData > 0 && (
          <Button
            onClick={() => document.getElementById('project-uploader-trigger')?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Import JSON
          </Button>
        )}
      </div>

      {/* TRẠNG THÁI 1: CHƯA CÓ PROJECT NÀO */}
      {!activeProjectId && (
        <div className="flex flex-1 items-center justify-center border-2 border-dashed rounded-lg bg-muted/10 p-12 text-center">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Chào mừng đến với Our18n</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Tạo một dự án mới ở thanh công cụ phía trên để bắt đầu hành trình bản địa hóa của bạn.
            </p>
          </div>
        </div>
      )}

      {/* TRẠNG THÁI 2: CÓ PROJECT NHƯNG RỖNG DATA */}
      {activeProjectId && hasData === 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ProjectUploader
            projectId={activeProjectId}
            onUploadComplete={() => { }}
          />
        </div>
      )}

      {/* TRẠNG THÁI 3: CÓ PROJECT & CÓ DATA */}
      {activeProjectId && hasData !== undefined && hasData > 0 && (
        <div className="flex-1 w-full space-y-4">
          <details className="group" id="project-uploader-details">
            <summary id="project-uploader-trigger" className="hidden"></summary>
            <div className="pb-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <ProjectUploader
                projectId={activeProjectId}
                onUploadComplete={() => {
                  document.getElementById('project-uploader-details')?.removeAttribute('open');
                }}
              />
            </div>
          </details>

          <TranslationTable />
        </div>
      )}
    </main>
  );
}