import { create } from "zustand";

interface TranslationState {
    sourceLang: string;
    targetLang: string;
    // Lưu JSON đã được làm phẳng: { "nav.home": "Home", "nav.about": "About" }
    sourceData: Record<string, string>;
    targetData: Record<string, string>;

    setSourceData: (data: Record<string, string>) => void;
    updateTargetTranslation: (key: string, value: string) => void;
}

export const useTranslationStore = create<TranslationState>((set) => ({
    sourceLang: "en",
    targetLang: "vi",
    sourceData: {},
    targetData: {},

    setSourceData: (data) => set({ sourceData: data, targetData: {} }), // Reset target khi upload source mới
    updateTargetTranslation: (key, value) =>
        set((state) => ({
            targetData: { ...state.targetData, [key]: value },
        })),
}));
