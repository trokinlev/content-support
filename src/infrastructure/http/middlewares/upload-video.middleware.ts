import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.INPUT_DIR!;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedMimes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/ogg",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Неподдерживаемый формат видео. Разрешены: MP4, MOV, AVI, WebM, OGG",
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB
  },
});

export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class UploadError extends AppError {
  constructor(message: string, statusCode: number = 400) {
    super(message, statusCode);
    this.name = "UploadError";
  }
}

export class FileTooLargeError extends UploadError {
  constructor() {
    super("Файл слишком большой. Максимальный размер: 5гб", 400);
    this.name = "FileTooLargeError";
  }
}

export class UnsupportedFileTypeError extends UploadError {
  constructor() {
    super(
      "Неподдерживаемый формат видео. Разрешены: MP4, MOV, AVI, WebM, OGG",
      400,
    );
    this.name = "UnsupportedFileTypeError";
  }
}

export class NoFileUploadedError extends UploadError {
  constructor() {
    super("Файл не выбран", 400);
    this.name = "NoFileUploadedError";
  }
}

export class BroadcastNotFoundError extends AppError {
  constructor() {
    super("Стрим не найден", 404);
    this.name = "BroadcastNotFoundError";
  }
}

export class ConversionError extends AppError {
  constructor(message: string = "Ошибка конвертации видео") {
    super(message, 500);
    this.name = "ConversionError";
  }
}

export const uploadVideo = (cache: Map<string, any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uploadSingle = upload.single("video");

    uploadSingle(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(new FileTooLargeError());
          }
          return next(new UploadError(`Ошибка загрузки: ${err.message}`));
        }
        return next(err);
      }

      if (!req.file) {
        return next(new NoFileUploadedError());
      }

      if (!req.params.tempId) {
        return next(new Error("tempId is required"));
      }

      if (!cache.has(req.params.tempId as string)) {
        return next(new Error("Нет tempId"));
      };

      next();
    });
  };
};
