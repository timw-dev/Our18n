"use client";

import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { type TranslationRow } from "@/lib/db";

interface VirtualizedTableBodyProps {
    table: TanStackTable<TranslationRow>;
    scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function VirtualizedTableBody({ table, scrollRef }: VirtualizedTableBodyProps) {
    const { rows } = table.getRowModel();

    // Khởi tạo Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        // Estimate size 64px (Chiều cao trung bình của 1 row Shadcn có padding)
        estimateSize: () => 64,
        // Giữ trước 10 dòng trên/dưới DOM để cuộn chuột nhanh không bị nháy (flicker) trắng
        overscan: 10,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalColumns = table.getAllColumns().length;

    if (rows.length === 0) {
        return (
            <TableBody>
                <TableRow>
                    <TableCell colSpan={totalColumns} className="h-24 text-center">
                        Không có dữ liệu phù hợp.
                    </TableCell>
                </TableRow>
            </TableBody>
        );
    }

    // Tính toán chiều cao không gian trống phía trên và dưới
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0;

    return (
        <TableBody>
            {/* Không gian đệm phía trên (Spacer Top) */}
            {paddingTop > 0 && (
                <TableRow>
                    <TableCell style={{ height: `${paddingTop}px` }} colSpan={totalColumns} className="p-0 border-0" />
                </TableRow>
            )}

            {/* Chỉ render các dòng nằm trong Viewport */}
            {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];

                const changeBorder =
                    row.original.changeStatus === "added" ? "border-l-4 border-emerald-500" :
                        row.original.changeStatus === "updated" ? "border-l-4 border-amber-500" : "";

                return (
                    <TableRow
                        key={row.id}
                        className={changeBorder}
                        // Quan trọng: Báo cho virtualizer biết kích thước thực tế sau khi render
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                    >
                        {row.getVisibleCells().map((cell, index) => {
                            const isReadOnly = index === 1;
                            return (
                                <TableCell
                                    key={cell.id}
                                    className={`align-top border-r last:border-r-0 ${isReadOnly ? "bg-muted/10" : ""}`}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                );
            })}

            {/* Không gian đệm phía dưới (Spacer Bottom) */}
            {paddingBottom > 0 && (
                <TableRow>
                    <TableCell style={{ height: `${paddingBottom}px` }} colSpan={totalColumns} className="p-0 border-0" />
                </TableRow>
            )}
        </TableBody>
    );
}