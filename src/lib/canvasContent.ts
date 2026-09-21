/** Shared helpers for content that may be an emoji string or a canvas snapshot. */
export const EMPTY_CANVAS = '';

/** True when `content` is a PNG/WebP data URL produced by the drawing canvas. */
export function isImageContent(content: string | null | undefined): boolean {
  return !!content && /^data:image\/(png|webp);base64,/.test(content);
}
