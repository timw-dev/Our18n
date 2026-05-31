import { create } from "zustand";

interface AppState {
    activeProjectId: string | null; // ID của project đang làm việc
    activeNamespaceId: string | null; // ID của file đang chọn (để filter bảng)
    searchQuery: string; // Từ khóa tìm kiếm trên bảng
    activeVersionId: string | null; // ID của phiên bản đang chọn

    setActiveProject: (id: string) => void;
    setActiveNamespace: (id: string | null) => void;
    setSearchQuery: (query: string) => void;
    setActiveVersion: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    activeProjectId: null,
    activeNamespaceId: null,
    searchQuery: "",
    activeVersionId: null,

    setActiveProject: (id) => set({ activeProjectId: id }),
    setActiveNamespace: (id) => set({ activeNamespaceId: id }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setActiveVersion: (id) => set({ activeVersionId: id }),
}));
