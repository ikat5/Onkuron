import { handler, json } from "@/lib/api";
import { INTERACTIVE_SECTION } from "@/lib/interactive";
import { listPublicCategories } from "@/services/categories";
import { listPublicTopics } from "@/services/interactive";
import { getIntroSafe } from "@/services/settings";

/** Public, read-only homepage content: published items only; the promo is null while switched off. */
export const GET = handler({ auth: "none" }, async () => {
  const [intro, categories, topics] = await Promise.all([getIntroSafe(), listPublicCategories(), listPublicTopics()]);
  return json({
    promo: intro.enabled ? { youtubeVideoId: intro.youtubeVideoId ?? null, videoUrl: intro.videoUrl ?? null, title: intro.title, text: intro.text, thumbnailUrl: intro.thumbnailUrl ?? null } : null,
    categories,
    interactive: { ...INTERACTIVE_SECTION, topics },
  });
});
