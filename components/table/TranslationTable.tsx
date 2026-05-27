"use client";

import { useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { flexRender } from "@tanstack/react-table";

import { db } from "@/lib/db";
import { useAppStore } from "@/app/store/useAppStore";
import { useTranslationColumns } from "@/hooks/useTranslationColumns";
import { useTranslationTable } from "@/hooks/useTranslationTable";

import { TranslationToolbar } from "./TranslationToolbar";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TranslationTable() {
    // Tạo Ref gắn vào thẻ bọc ngoài cùng của Table
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const { activeProjectId } = useAppStore();

    // 1. Data Fetching
    const project = useLiveQuery(
        () => activeProjectId ? db.projects.get(activeProjectId) : undefined,
        [activeProjectId]
    );

    const rawRows = useLiveQuery(
        () => activeProjectId ? db.translationRows.where({ projectId: activeProjectId }).toArray() : [],
        [activeProjectId]
    );

    // MỚI: Kéo thêm danh sách namespaces để map tên file
    const namespaces = useLiveQuery(
        () => activeProjectId ? db.namespaces.where({ projectId: activeProjectId }).toArray() : [],
        [activeProjectId]
    );

    // 2. Init Hooks
    const data = useMemo(() => rawRows || [], [rawRows]);
    const columns = useTranslationColumns(project, namespaces || []);
    const table = useTranslationTable(data, columns);

    // 3. Fallbacks
    if (!activeProjectId || !project) {
        return <div className="p-10 text-center text-muted-foreground">Vui lòng chọn Project.</div>;
    }


    return (
        <div className="w-full space-y-4">
            {/* THÊM STICKY VÀO TOOLBAR (Priority #5) */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 pb-2 pt-2">
                <TranslationToolbar table={table} totalRows={data.length} />
            </div>

            <div
                ref={tableContainerRef}
                className="border rounded-md shadow-sm bg-background w-full overflow-auto max-h-[calc(100vh-280px)]"
            >
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="bg-muted/50">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="border-r last:border-r-0">
                                        {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    {/* Bơm scrollRef vào Virtualized Component */}
                    <VirtualizedTableBody table={table} scrollRef={tableContainerRef} />
                </Table>
            </div>
        </div>
    );
}