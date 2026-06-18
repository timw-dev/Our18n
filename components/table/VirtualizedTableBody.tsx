"use client";

import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type TranslationRow } from "@/lib/db";
import { cn } from "@/lib/utils";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo } from "react";

interface VirtualizedTableBodyProps {
    table: TanStackTable<TranslationRow>;
    scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function VirtualizedTableBody({
    table,
    scrollRef,
}: VirtualizedTableBodyProps) {
    const { rows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 64,
        overscan: 10,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalColumns = table.getAllColumns().length;

    if (rows.length === 0) {
        return (
            <TableBody>
                <TableRow>
                    <TableCell
                        colSpan={totalColumns}
                        className="h-24 text-center"
                    >
                        Không có dữ liệu phù hợp.
                    </TableCell>
                </TableRow>
            </TableBody>
        );
    }

    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom =
        virtualItems.length > 0
            ? rowVirtualizer.getTotalSize() -
            virtualItems[virtualItems.length - 1].end
            : 0;

    return (
        <TableBody>
            {paddingTop > 0 && (
                <TableRow>
                    <TableCell
                        style={{ height: `${paddingTop}px` }}
                        colSpan={totalColumns}
                        className="p-0 border-0"
                    />
                </TableRow>
            )}

            {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                const changeBorder =
                    row.original.changeStatus === "added"
                        ? "border-l-4 border-emerald-500"
                        : row.original.changeStatus === "updated"
                            ? "border-l-4 border-amber-500"
                            : "";

                return (
                    <TableRow
                        key={row.id}
                        className={cn(changeBorder, "group")}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                    >
                        {row.getVisibleCells().map((cell) => {
                            const isActions = cell.column.id === "actions";
                            const isStatus = cell.column.id === "status";
                            const isSticky = isActions || isStatus;

                            return (
                                <TableCell
                                    key={cell.id}
                                    style={{
                                        right: isActions
                                            ? 0
                                            : isStatus
                                                ? 60
                                                : undefined,
                                        height: "1px",
                                    }}
                                    className={cn(
                                        "align-top border-r last:border-r-0 p-0 transition-colors bg-background",
                                        // SỬA: Thay thế bg-red-500 và bg-blue-500 bằng bg-background chuẩn khối đặc
                                        isActions &&
                                        "sticky right-0 z-30 bg-background border-l-2 border-l-muted shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] group-hover:bg-muted/40",
                                        isStatus &&
                                        "sticky z-30 bg-background border-l-2 border-l-mutedshadow-[-6px_0_10px_-4px_rgba(0,0,0,0.04)] group-hover:bg-muted/40",
                                        !isSticky && "hover:bg-muted/30",
                                    )}
                                >
                                    {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext(),
                                    )}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                );
            })}

            {paddingBottom > 0 && (
                <TableRow>
                    <TableCell
                        style={{ height: `${paddingBottom}px` }}
                        colSpan={totalColumns}
                        className="p-0 border-0"
                    />
                </TableRow>
            )}
        </TableBody>
    );
}