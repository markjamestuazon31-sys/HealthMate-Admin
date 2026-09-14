export interface CompressedImageData {
  imageData: string;
  imageMimeType: "image/jpeg";
  width: number;
  height: number;
  byteSize: number;
}

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_CHARACTERS = 900_000;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 900;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be read."));
    };
    image.src = objectUrl;
  });
}

function calculateSize(width: number, height: number, scale = 1) {
  const boundedScale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height) * scale;
  return {
    width: Math.max(1, Math.round(width * boundedScale)),
    height: Math.max(1, Math.round(height * boundedScale)),
  };
}

function renderJpeg(image: HTMLImageElement, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process announcement images.");

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("The processed image data is invalid.");
  return dataUrl.slice(commaIndex + 1);
}

export async function compressAnnouncementImage(file: File): Promise<CompressedImageData> {
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size <= 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("The original image must be 8 MB or smaller.");
  }

  const image = await loadImage(file);
  const attempts = [
    { scale: 1, quality: 0.82 },
    { scale: 0.9, quality: 0.74 },
    { scale: 0.78, quality: 0.68 },
    { scale: 0.66, quality: 0.6 },
    { scale: 0.55, quality: 0.54 },
  ];

  for (const attempt of attempts) {
    const size = calculateSize(image.naturalWidth, image.naturalHeight, attempt.scale);
    const imageData = renderJpeg(image, size.width, size.height, attempt.quality);
    if (imageData.length <= MAX_BASE64_CHARACTERS) {
      return {
        imageData,
        imageMimeType: "image/jpeg",
        width: size.width,
        height: size.height,
        byteSize: Math.ceil((imageData.length * 3) / 4),
      };
    }
  }

  throw new Error("The image is still too large after compression. Choose a smaller image.");
}

export function announcementImageSource(imageData?: string, imageMimeType?: string) {
  if (!imageData?.trim()) return "";
  if (imageData.startsWith("data:")) return imageData;
  return `data:${imageMimeType?.trim() || "image/jpeg"};base64,${imageData}`;
}

export interface CompressedProfileImageData {
  imageData: string;
  imageMimeType: "image/jpeg";
  width: number;
  height: number;
  byteSize: number;
}

const PROFILE_IMAGE_SIZE = 320;
const PROFILE_MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const PROFILE_MAX_BASE64_CHARACTERS = 340_000;

function renderSquareJpeg(image: HTMLImageElement, size: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process profile images.");

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, size, size);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  );

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("The processed profile image is invalid.");
  return dataUrl.slice(commaIndex + 1);
}

export async function compressProfileImage(file: File): Promise<CompressedProfileImageData> {
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size <= 0) throw new Error("The selected image is empty.");
  if (file.size > PROFILE_MAX_SOURCE_BYTES) {
    throw new Error("The original profile image must be 6 MB or smaller.");
  }

  const image = await loadImage(file);
  const attempts = [
    { size: PROFILE_IMAGE_SIZE, quality: 0.84 },
    { size: 300, quality: 0.74 },
    { size: 280, quality: 0.66 },
    { size: 240, quality: 0.58 },
  ];

  for (const attempt of attempts) {
    const imageData = renderSquareJpeg(image, attempt.size, attempt.quality);
    if (imageData.length <= PROFILE_MAX_BASE64_CHARACTERS) {
      return {
        imageData,
        imageMimeType: "image/jpeg",
        width: attempt.size,
        height: attempt.size,
        byteSize: Math.ceil((imageData.length * 3) / 4),
      };
    }
  }

  throw new Error("The profile image remains too large after compression. Choose a simpler image.");
}

export function profileImageSource(imageData?: string, imageMimeType?: string) {
  if (!imageData?.trim()) return "";
  if (imageData.startsWith("data:")) return imageData;
  return `data:${imageMimeType?.trim() || "image/jpeg"};base64,${imageData}`;
}

/**
 * Android stores user profile images as raw Base64 JPEG strings. Browser image
 * elements require a data URL, so the admin portal converts them at render time
 * instead of copying the image into emergency records.
 */
export function mobileProfileImageSource(value?: string, mimeType = "image/jpeg") {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "null") return "";
  if (normalized.startsWith("data:")) return normalized;
  return `data:${mimeType};base64,${normalized}`;
}
