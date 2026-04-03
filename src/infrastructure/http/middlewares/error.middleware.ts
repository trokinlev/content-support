import { NextFunction, Request, Response } from "express";
import { AppError } from "./upload-video.middleware";
import { MulterError } from "multer";

export const error = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.name,
        message: err.message,
        // ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      },
    });
  }

  if (err instanceof MulterError) {
    let message = "Ошибка загрузки файла";
    let statusCode = 400;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "Файл слишком большой. Максимальный размер: 5гб";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Слишком много файлов";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Некорректное имя поля";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Некорректное значение поля";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Слишком много полей";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Неожиданный файл";
        break;
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message,
        field: err.field,
      },
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        // ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      },
    });
  }

  if (err.name === "MongoError" || err.name === "MongoServerError") {
    return res.status(500).json({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "Ошибка базы данных",
        // ...(process.env.NODE_ENV === "development" && {
        //   details: err.message,
        //   stack: err.stack,
        // }),
      },
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "Внутренняя ошибка сервера"
          : err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};
