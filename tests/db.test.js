import { describe, expect, test } from "bun:test";
import { buildTranslationCellUpdate } from "../lib/db";

const makeRow = (overrides = {}) => ({
    id: "row-1",
    projectId: "project-1",
    namespaceId: "common",
    key: "greeting",
    values: { en: "Hello", vi: "Xin chao" },
    originalValues: { en: "Hello", vi: "Xin chao" },
    translationStatus: {},
    changeStatus: "unchanged",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
});

describe("buildTranslationCellUpdate", () => {
    test("marks a changed cell and row as updated", () => {
        const update = buildTranslationCellUpdate(makeRow(), "vi", "Xin chào");
        expect(update.values.vi).toBe("Xin chào");
        expect(update.changeStatus).toBe("updated");
        expect(update.cellMeta?.vi).toMatchObject({ changeStatus: "updated", translationStatus: "translated" });
    });

    test("returns the row to unchanged after reverting the last changed cell", () => {
        const row = makeRow({ values: { en: "Hello", vi: "Đã sửa" }, changeStatus: "updated" });
        const update = buildTranslationCellUpdate(row, "vi", "Xin chao");
        expect(update.changeStatus).toBe("unchanged");
        expect(update.cellMeta?.vi?.changeStatus).toBe("unchanged");
    });

    test("preserves added and deleted lifecycle states", () => {
        expect(buildTranslationCellUpdate(makeRow({ changeStatus: "added" }), "vi", "Mới").changeStatus).toBe("added");
        expect(buildTranslationCellUpdate(makeRow({ changeStatus: "deleted" }), "vi", "Đã xóa").changeStatus).toBe("deleted");
    });

    test("preserves meaningful whitespace while deriving missing status from trim", () => {
        const update = buildTranslationCellUpdate(makeRow(), "vi", "  Xin chao  ");
        expect(update.values.vi).toBe("  Xin chao  ");
        expect(update.cellMeta?.vi?.translationStatus).toBe("translated");
        const blank = buildTranslationCellUpdate(makeRow(), "vi", "   ");
        expect(blank.values.vi).toBe("   ");
        expect(blank.cellMeta?.vi?.translationStatus).toBe("missing");
    });
});
