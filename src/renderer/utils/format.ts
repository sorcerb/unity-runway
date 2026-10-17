export const formatSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) {
        return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
};
