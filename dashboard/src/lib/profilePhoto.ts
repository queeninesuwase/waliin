const PHOTO_EVENT = "waliin-photo-change";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_SIZE = 256;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function photoKey(userId: string) {
  return `waliin-photo-${userId}`;
}

export function checkPhotoFile(file: { type: string; size: number }) {
  if (!PHOTO_TYPES.includes(file.type))
    return "Choose a PNG, JPG or WebP image.";
  if (file.size > MAX_PHOTO_BYTES) return "Choose an image smaller than 5 MB.";
  return "";
}

export function readPhoto(userId: string) {
  try {
    return window.localStorage.getItem(photoKey(userId));
  } catch {
    return null;
  }
}

export function savePhoto(userId: string, dataUrl: string | null) {
  try {
    if (dataUrl) window.localStorage.setItem(photoKey(userId), dataUrl);
    else window.localStorage.removeItem(photoKey(userId));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(PHOTO_EVENT));
  return true;
}

export function subscribePhoto(onChange: () => void) {
  window.addEventListener(PHOTO_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PHOTO_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}

export async function resizePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const { x, y, side } = squareCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");
  context.drawImage(bitmap, x, y, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
