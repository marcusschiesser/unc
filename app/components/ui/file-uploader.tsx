import { FileWrap } from "@/app/utils/file";
import { ChangeEvent, useState } from "react";
import UploadFileIcon from "../../icons/upload-file.svg";
import Locale from "../../locales";
import styles from "./file-uploader.module.scss";
import SpinnerIcon from "../../icons/spinner.svg";

export interface FileUploaderProps {
  config?: {
    inputId?: string;
    fileSizeLimit?: number;
    allowedExtensions?: string[];
  };
  onUpload: (file: FileWrap) => Promise<void>;
  onError: (errMsg: string) => void;
}

const DEFAULT_INPUT_ID = "fileInput";
const DEFAULT_FILE_SIZE_LIMIT = 1024 * 1024 * 50; // 50 MB

export default function FileUploader({
  config,
  onUpload,
  onError,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const inputId = config?.inputId || DEFAULT_INPUT_ID;
  const fileSizeLimit = config?.fileSizeLimit || DEFAULT_FILE_SIZE_LIMIT;
  const allowedExtensions = config?.allowedExtensions;

  const shouldCheckFileExtension =
    allowedExtensions != null && allowedExtensions.length > 0;

  const isFileExtensionValid = (file: FileWrap) => {
    if (!shouldCheckFileExtension) return true;
    return allowedExtensions.includes(file.extension);
  };

  const isFileSizeExceeded = (file: FileWrap) => {
    return file.size > fileSizeLimit;
  };

  const resetInput = () => {
    const fileInput = document.getElementById(inputId) as HTMLInputElement;
    fileInput.value = "";
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileWrap = new FileWrap(file);
    await handleUpload(fileWrap);
    resetInput();
    setUploading(false);
  };

  const handleUpload = async (file: FileWrap) => {
    if (!isFileExtensionValid(file)) {
      return onError(Locale.Upload.Invalid(allowedExtensions!.join(",")));
    }

    if (isFileSizeExceeded(file)) {
      return onError(Locale.Upload.SizeExceeded(fileSizeLimit / 1024 / 1024));
    }

    await onUpload(file);
  };

  return (
    <div className={styles["upload-file-wrapper"]}>
      <input
        type="file"
        id={inputId}
        style={{ display: "none" }}
        onChange={onFileChange}
        accept={allowedExtensions?.join(",")}
        disabled={uploading}
      />
      <label htmlFor={inputId} className={styles["upload-file-trigger"]}>
        <div className={styles["upload-file-btn"]}>
          {uploading ? <SpinnerIcon /> : <UploadFileIcon />}
        </div>
      </label>
    </div>
  );
}
