/** Crops the middle square of a picture and scales it to `size`, as WebP (JPEG where WebP can't be encoded). */
export async function squareImage(file: File, size = 256): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.86);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("Couldn't prepare that image.");
  return jpeg;
}

/** How rare an achievement is, from the share of players who own it. */
export function rarityLabel(share: number) {
  if (share === 0) return "Unclaimed";
  if (share < 0.01) return "Legendary";
  if (share < 0.05) return "Epic";
  if (share < 0.2) return "Rare";
  if (share < 0.5) return "Uncommon";
  return "Common";
}

export function percent(share: number) {
  const p = share * 100;
  return p === 0 ? "0%" : p < 0.1 ? "<0.1%" : p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}
