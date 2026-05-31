import { SnapshotRow } from "./db";

export interface DiffRow {
    key: string;
    namespacePath: string;
    type: "added" | "removed" | "modified" | "unchanged";
    // Chi tiết thay đổi từng ngôn ngữ
    languages: Record<
        string,
        {
            oldValue: string;
            newValue: string;
            isChanged: boolean;
        }
    >;
}

export const calculateSnapshotDiff = (
    baseSnap: SnapshotRow[],
    targetSnap: SnapshotRow[],
    languages: string[],
    namespaceMap: Map<string, string>, // ID -> Path
): DiffRow[] => {
    const diffs: DiffRow[] = [];

    // Gom nhóm dữ liệu để truy xuất O(1)
    const baseMap = new Map(
        baseSnap.map((r) => [`${r.namespaceId}:${r.key}`, r]),
    );
    const targetMap = new Map(
        targetSnap.map((r) => [`${r.namespaceId}:${r.key}`, r]),
    );

    // Lấy tất cả các keys duy nhất xuất hiện ở cả 2 bản
    const allUniqueKeys = Array.from(
        new Set([
            ...Array.from(baseMap.keys()),
            ...Array.from(targetMap.keys()),
        ]),
    );

    for (const fullKey of allUniqueKeys) {
        const baseRow = baseMap.get(fullKey);
        const targetRow = targetMap.get(fullKey);

        const rowData = (targetRow || baseRow)!;
        const nsPath = namespaceMap.get(rowData.namespaceId) || "Unknown File";

        const diffRow: DiffRow = {
            key: rowData.key,
            namespacePath: nsPath,
            type: "unchanged",
            languages: {},
        };

        if (!baseRow) {
            diffRow.type = "added";
        } else if (!targetRow) {
            diffRow.type = "removed";
        }

        let hasModification = false;

        for (const lang of languages) {
            const oldVal = baseRow?.values[lang] || "";
            const newVal = targetRow?.values[lang] || "";
            const isChanged = oldVal !== newVal;

            if (isChanged && diffRow.type === "unchanged") {
                hasModification = true;
            }

            diffRow.languages[lang] = {
                oldValue: oldVal,
                newValue: newVal,
                isChanged,
            };
        }

        if (hasModification) diffRow.type = "modified";

        diffs.push(diffRow);
    }

    return diffs;
};
