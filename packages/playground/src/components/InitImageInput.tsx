import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Field } from "./ui/Field";
import "./InitImageInput.css";

type ImageSource = "url" | "upload";

interface InitImageInputProps {
  imageUrl: string;
  imageSource: ImageSource;
  imageData: ImageData | null;
  onImageUrlChange: (value: string) => void;
  onImageSourceChange: (value: ImageSource) => void;
  onImageDataChange: (value: ImageData | null) => void;
}

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;

const createCanvas = (): CanvasLike | null => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(1, 1);
  }
  if (typeof document !== "undefined") {
    return document.createElement("canvas");
  }
  return null;
};

async function drawBitmapToImageData(bitmap: ImageBitmap): Promise<ImageData> {
  const canvas = createCanvas();
  if (!canvas) throw new Error("Canvas is not available.");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not available.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return imageData;
}

async function drawImageToImageData(img: HTMLImageElement): Promise<ImageData> {
  const canvas = createCanvas();
  if (!canvas) throw new Error("Canvas is not available.");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is not available.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function decodeImageBlob(blob: Blob): Promise<ImageData> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return drawBitmapToImageData(bitmap);
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode image."));
      image.src = objectUrl;
    });
    return drawImageToImageData(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function InitImageInput({
  imageUrl,
  imageSource,
  imageData,
  onImageUrlChange,
  onImageSourceChange,
  onImageDataChange,
}: InitImageInputProps) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetStatus = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const handleFileButtonClick = useCallback(() => {
    if (imageSource === "upload") {
      onImageSourceChange("url");
      onImageDataChange(null);
      resetStatus();
      return;
    }
    fileInputRef.current?.click();
  }, [imageSource, onImageDataChange, onImageSourceChange, resetStatus]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      onImageSourceChange("upload");
      resetStatus();
      setStatus("loading");

      try {
        const nextImageData = await decodeImageBlob(file);
        onImageDataChange(nextImageData);
        setStatus("idle");
      } catch (err) {
        onImageDataChange(null);
        setStatus("idle");
        setError(err instanceof Error ? err.message : "Failed to load image.");
      } finally {
        event.target.value = "";
      }
    },
    [onImageDataChange, onImageSourceChange, resetStatus]
  );

  useEffect(() => {
    if (imageSource !== "url") {
      abortRef.current?.abort();
      resetStatus();
      return;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed) {
      onImageDataChange(null);
      resetStatus();
      return;
    }

    const timeout = window.setTimeout(() => {
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      setError(null);

      void (async () => {
        try {
          const response = await fetch(trimmed, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`Failed to fetch image (${response.status}).`);
          }
          const blob = await response.blob();
          const nextImageData = await decodeImageBlob(blob);
          if (requestId !== requestIdRef.current) return;
          onImageDataChange(nextImageData);
          setStatus("idle");
        } catch (err) {
          if (controller.signal.aborted) return;
          if (requestId !== requestIdRef.current) return;
          onImageDataChange(null);
          setStatus("idle");
          setError(err instanceof Error ? err.message : "Failed to load image.");
        }
      })();
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [imageSource, imageUrl, onImageDataChange, resetStatus]);

  const isUrlDisabled = imageSource === "upload";

  return (
    <Field className="init-image-field">
      <label className="init-image-label">
        Image URL
        <div className="init-image-row">
          <input
            className="init-image-input"
            type="url"
            value={imageUrl}
            placeholder="https://example.com/image.png"
            onChange={(event) => onImageUrlChange(event.target.value)}
            disabled={isUrlDisabled}
          />
          <button
            type="button"
            className="init-image-button"
            onClick={handleFileButtonClick}
            aria-label={isUrlDisabled ? "Remove uploaded image" : "Upload image"}
          >
            {isUrlDisabled ? <Trash2 size={16} /> : <Upload size={16} />}
          </button>
          <input
            ref={fileInputRef}
            className="init-image-file-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            tabIndex={-1}
          />
        </div>
      </label>
      {status === "loading" && (
        <div className="init-image-status">Loading image...</div>
      )}
      {error && <div className="init-image-error">{error}</div>}
      {imageSource === "upload" && imageData && !error && status === "idle" && (
        <div className="init-image-status">
          Uploaded image {imageData.width}×{imageData.height}
        </div>
      )}
    </Field>
  );
}
