import { cookies } from "next/headers";
import LoadingState from "@/components/LoadingState";

// Server-rendered route loader: read the saved language from the cookie so the
// fallback shown during navigation matches the user's language (localStorage is
// not available on the server).
export default async function AppLoading() {
  const cookieStore = await cookies();
  const saved = cookieStore.get("sinan-lang")?.value;
  const language = saved === "ar" ? "ar" : "en";
  return <LoadingState forcedLanguage={language} />;
}
