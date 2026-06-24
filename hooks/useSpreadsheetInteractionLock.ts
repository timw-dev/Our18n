"use client";

import { useEffect } from "react";
import { useSpreadsheetStore } from "@/app/store/useSpreadsheetStore";

export function useSpreadsheetInteractionLock(key: string, locked: boolean) {
    const setInteractionLock = useSpreadsheetStore((state) => state.setInteractionLock);

    useEffect(() => {
        setInteractionLock(key, locked);
        return () => setInteractionLock(key, false);
    }, [key, locked, setInteractionLock]);
}
