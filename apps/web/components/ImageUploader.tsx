"use client";

import { useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getImageUploadUrl } from "../lib/api";

type UploadState = "idle" | "uploading" | "success" | "error";

export function ImageUploader({ onUpload }: { onUpload: (url: string) => void }) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<Record<string, UploadState>>({});
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      setFiles(selectedFiles);
      handleUpload(selectedFiles);
    }
  };

  const handleUpload = async (filesToUpload: File[]) => {
    if (!token) {
      alert("You must be logged in to upload images.");
      return;
    }

    for (const file of filesToUpload) {
      setUploadState((prev) => ({ ...prev, [file.name]: "uploading" }));
      try {
        const { signedUrl, publicUrl } = await getImageUploadUrl(file.type, token);

        await fetch(signedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        onUpload(publicUrl);
        setUploadState((prev) => ({ ...prev, [file.name]: "success" }));
      } catch (error) {
        console.error("Failed to upload file:", file.name, error);
        setUploadState((prev) => ({ ...prev, [file.name]: "error" }));
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files) {
      const selectedFiles = Array.from(event.dataTransfer.files);
      setFiles(selectedFiles);
      handleUpload(selectedFiles);
    }
  };

  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      Images
      <div
        className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-3 py-6 text-slate-500 transition-colors ${
          isDragActive ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        Drag & drop images here, or click to browse
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2 pt-2">
        {files.map((file, i) => (
          <div key={i} className="relative h-24 w-24">
            <img
              src={URL.createObjectURL(file)}
              alt={`preview ${i}`}
              className="h-full w-full rounded-lg object-cover"
            />
            {uploadState[file.name] === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-white">
                ...
              </div>
            )}
            {uploadState[file.name] === "success" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-green-500/70 text-white">
                ✓
              </div>
            )}
            {uploadState[file.name] === "error" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-500/70 text-white">
                !
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
