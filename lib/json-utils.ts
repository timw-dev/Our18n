/* eslint-disable @typescript-eslint/no-explicit-any */
// Chuyển { "nav": { "home": "Trang chủ" } } -> { "nav.home": "Trang chủ" }
export const flattenJSON = (
    obj: Record<string, any>,
    prefix = "",
): Record<string, string> => {
    return Object.keys(obj).reduce((acc: Record<string, string>, k: string) => {
        const pre = prefix.length ? prefix + "." : "";
        if (
            typeof obj[k] === "object" &&
            obj[k] !== null &&
            !Array.isArray(obj[k])
        ) {
            Object.assign(acc, flattenJSON(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
};

// Chuyển ngược { "nav.home": "Trang chủ" } -> { "nav": { "home": "Trang chủ" } }
export const unflattenJSON = (
    data: Record<string, string>,
): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const i in data) {
        const keys = i.split(".");
        keys.reduce((acc, key, index) => {
            if (index === keys.length - 1) {
                acc[key] = data[i];
            } else {
                acc[key] = acc[key] || {};
            }
            return acc[key];
        }, result);
    }
    return result;
};
