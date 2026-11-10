export type AiReferenceImage = {
  dataUrl: string;
  name: string;
  mimeType: string;
  size: number;
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validateAiReferenceImage(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Choose an image smaller than 6 MB.";
  }

  return null;
}

export function readAiReferenceImage(file: File): Promise<AiReferenceImage> {
  const validationError = validateAiReferenceImage(file);

  if (validationError) {
    return Promise.reject(new Error(validationError));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the reference image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the reference image."));
        return;
      }

      resolve({ dataUrl: reader.result, name: file.name || "Reference image", mimeType: file.type, size: file.size });
    };
    reader.readAsDataURL(file);
  });
}
