export const getEventBackground = (event, currentLang) => {
    if (!event || !event.background) return null;

    const langKey = currentLang === "ar" ? "ar" : "en";
    const bg = event.background[langKey];

    if (
        bg &&
        typeof bg === "object" &&
        bg.url &&
        String(bg.url).trim() !== ""
    ) {
        let fileType = bg.fileType;
        if (!fileType) {
            const urlLower = String(bg.url).toLowerCase();
            if (urlLower.match(/\.(mp4|webm|ogg|mov|avi)$/)) {
                fileType = "video";
            } else {
                fileType = "image";
            }
        }
        return {
            url: bg.url,
            fileType: fileType,
        };
    }

    const otherLangKey = currentLang === "ar" ? "en" : "ar";
    const otherBg = event.background[otherLangKey];
    if (
        otherBg &&
        typeof otherBg === "object" &&
        otherBg.url &&
        String(otherBg.url).trim() !== ""
    ) {
        let fileType = otherBg.fileType;
        if (!fileType) {
            const urlLower = String(otherBg.url).toLowerCase();
            if (urlLower.match(/\.(mp4|webm|ogg|mov|avi)$/)) {
                fileType = "video";
            } else {
                fileType = "image";
            }
        }
        return {
            url: otherBg.url,
            fileType: fileType,
        };
    }

    return null;
};

