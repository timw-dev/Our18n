import { type TranslationStatus, type ChangeStatus } from "./db";

// Kiểm tra xem đã dịch chưa
export const getTranslationStatus = (value: string): TranslationStatus => {
    return value.trim() !== "" ? "translated" : "missing";
};

// Kiểm tra xem có sự thay đổi so với bản gốc (snapshot) không
export const getChangeStatus = (
    originalValue: string,
    currentValue: string,
): ChangeStatus => {
    return originalValue !== currentValue ? "updated" : "unchanged";
};

// Hàm helper tiện dụng
export const isMissingValue = (value: string): boolean => {
    return value.trim() === "";
};
