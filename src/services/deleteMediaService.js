import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

/**
 * Universal Media Deletion Service
 */
export const deleteMedia = withApiHandler(
    async ({
        fileUrl,
        storageType = "s3",
        eventId,
        mediaType,
        eventType = "public",
        removeBrandingLogoIds,
        gameId,
        questionId,
        answerImageIndex,
        formId,
        questionIndex,
        optionIndex,
        pollId,
        spinWheelId,
        memoryImageId,
        deleteAllMemoryImages,
        defaultQrWrapperBrandingId,
        defaultQrWrapperClearAllBranding,
    }) => {
        const isDefaultQrWrapper =
            mediaType === "defaultQrWrapperLogo" ||
            mediaType === "defaultQrWrapperBackground" ||
            (mediaType === "defaultQrWrapperBranding" && (defaultQrWrapperBrandingId || defaultQrWrapperClearAllBranding));
        if (!fileUrl && mediaType !== "memoryImage" && !isDefaultQrWrapper) {
            throw new Error("File URL is required");
        }

        const payload = {
            storageType,
        };

        if (fileUrl) payload.fileUrl = fileUrl;
        if (eventId) payload.eventId = eventId;
        if (mediaType) payload.mediaType = mediaType;
        if (eventType) payload.eventType = eventType;
        if (removeBrandingLogoIds) payload.removeBrandingLogoIds = removeBrandingLogoIds;
        if (gameId) payload.gameId = gameId;
        if (questionId) payload.questionId = questionId;
        if (answerImageIndex !== undefined) payload.answerImageIndex = answerImageIndex;
        if (formId) payload.formId = formId;
        if (questionIndex !== undefined) payload.questionIndex = questionIndex;
        if (optionIndex !== undefined) payload.optionIndex = optionIndex;
        if (pollId) payload.pollId = pollId;
        if (spinWheelId) payload.spinWheelId = spinWheelId;
        if (memoryImageId) payload.memoryImageId = memoryImageId;
        if (deleteAllMemoryImages) payload.deleteAllMemoryImages = deleteAllMemoryImages;
        if (defaultQrWrapperBrandingId) payload.defaultQrWrapperBrandingId = defaultQrWrapperBrandingId;
        if (defaultQrWrapperClearAllBranding) payload.defaultQrWrapperClearAllBranding = defaultQrWrapperClearAllBranding;

        const { data } = await api.post("/media/delete", payload);
        return data;
    },
    { showSuccess: true }
);

