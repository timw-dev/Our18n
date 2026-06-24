import { describe, expect, test } from "bun:test";
import { classifyImportedCell } from "../lib/import-utils";

describe("classifyImportedCell three-way comparison", () => {
    test("detects a conflict when local and incoming diverge from the same baseline", () => {
        expect(classifyImportedCell("Hello", "Local edit", "Incoming edit")).toBe("conflict");
    });

    test("detects conflict when the local edit is an empty value", () => {
        expect(classifyImportedCell("Hello", "", "Incoming edit")).toBe("conflict");
    });

    test("accepts incoming when local still equals baseline", () => {
        expect(classifyImportedCell("Hello", "Hello", "Incoming edit")).toBe("safe-update");
    });

    test("keeps local when incoming still equals baseline", () => {
        expect(classifyImportedCell("Hello", "Local edit", "Hello")).toBe("keep-local");
    });

    test("does nothing when local and incoming already agree", () => {
        expect(classifyImportedCell("Hello", "Same edit", "Same edit")).toBe("unchanged");
    });
});
