import api from "./api";

export async function translateBatch(texts, targetLang, format = "text") {
  if (!texts.length) return texts;
  try {
    const res = await api.post("/translate/batch", { texts, targetLang, format });
    return res.data?.data?.translated ?? texts;
  } catch {
    return texts;
  }
}
