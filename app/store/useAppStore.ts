import { create } from "zustand";

interface AppState {
    activeProjectId: string | null; // ID của project đang làm việc
    activeNamespaceId: string | null; // ID của file đang chọn (để filter bảng)
    searchQuery: string; // Từ khóa tìm kiếm trên bảng

    setActiveProject: (id: string) => void;
    setActiveNamespace: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
    activeProjectId: null,
    activeNamespaceId: null,
    searchQuery: "",

    setActiveProject: (id) => set({ activeProjectId: id }),
    setActiveNamespace: (id) => set({ activeNamespaceId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
}));
