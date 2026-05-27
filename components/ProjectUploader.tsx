"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FolderUp } from "lucide-react";
import { processImportedFiles } from "@/lib/import-utils";

interface ProjectUploaderProps {
    projectId: string;
    onUploadComplete: () => void;
}

export default function ProjectUploader({ projectId, onUploadComplete }: ProjectUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [langCode, setLangCode] = useState("en"); // Mặc định import vào cột 'en' trước

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;
            setIsUploading(true);
            try {
                await processImportedFiles(projectId, langCode, acceptedFiles);
                onUploadComplete(); // Bắn event ra ngoài để refresh lại Table
            } catch (error) {
                console.error("Lỗi khi import file:", error);
                alert("Có lỗi xảy ra khi đọc file. Hãy kiểm tra console.");
            } finally {
                setIsUploading(false);
            }
        },
        [projectId, langCode, onUploadComplete]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/json": [".json"] },
    });

    return (
        <div className="w-full mx-auto space-y-4">
            <div className="flex items-center justify-between px-2">
                <label className="text-sm font-medium">Ngôn ngữ của file sắp tải lên:</label>
                <select
                    value={langCode}
                    onChange={(e) => setLangCode(e.target.value)}
                    className="p-1 border rounded-md text-sm"
                >
                    <option value="en">English (en)</option>
                    <option value="vi">Tiếng Việt (vi)</option>
                    <option value="ko">Korean (ko)</option>
                </select>
            </div>

            <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25 bg-muted/50 hover:bg-muted/100"
                    }`}
            >
                {/* Thuộc tính webkitdirectory cho phép chọn folder nếu click vào (không chỉ kéo thả) */}
                <input {...getInputProps()}
                    // @ts-expect-error - webkitdirectory là standard mới nhưng type của react-dropzone chưa update kịp
                    webkitdirectory=""
                />
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3" />
                    ) : (
                        <FolderUp className="w-10 h-10 mb-3 text-muted-foreground" />
                    )}
                    <p className="mb-2 text-sm font-semibold">
                        {isUploading ? "Đang xử lý dữ liệu..." : "Kéo thả Folder hoặc nhiều file JSON vào đây"}
                    </p>
                    <p className="text-xs text-muted-foreground text-center px-4">
                        Hệ thống sẽ tự động giữ nguyên cấu trúc thư mục của bạn. <br />
                        Bạn có thể ném nguyên folder `src/locales` vào đây.
                    </p>
                </div>
            </div>
        </div>
    );
}