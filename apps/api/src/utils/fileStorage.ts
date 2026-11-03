import multer from "multer";
import path from "node:path";
import { env } from "@repo/utils";

/** Hard ceiling from the plan: a dataset file may never exceed 50 MB. */
const MAX_UPLOAD_MB = Math.min(50, Math.max(1, env.UPLOAD_MAX_MB ?? 25));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const allowedTypes: Record<string, string[]> = {
      ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"],
      ".xlsx": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
      ],
    };

    const allowedMimeTypes = allowedTypes[ext];

    if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only CSV and XLSX files are allowed"));
    }

    cb(null, true);
  },
});

export default upload;
