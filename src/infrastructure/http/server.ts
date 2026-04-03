import express from "express";
import { uploadVideo } from "./middlewares/upload-video.middleware";
import { UploadController } from "./controllers/upload.controller";
import { error } from "./middlewares/error.middleware";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export const listen = (
  uploadController: UploadController,
  cache: Map<string, any>,
) => {
  app.get("/:tempId", uploadController.getPageUpload.bind(uploadController));
  app.post(
    "/:tempId/upload",
    uploadVideo(cache),
    uploadController.uploadVideo.bind(uploadController),
  );

  app.use(error);

  app.listen(PORT, () => {
    console.log(3000);
  });
};
