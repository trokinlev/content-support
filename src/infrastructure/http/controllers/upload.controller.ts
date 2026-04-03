import { Request, Response } from "express";
import { Video, VideoProcessor, VideoRepository } from "../../../video";
import path from "node:path";
import { Broadcast, Notifier } from "../../../broadcast/broadcast";
import { BroadcastOrganizer } from "../../../broadcast/broadcast-organizer";

export class UploadController {
  constructor(
    private readonly videoProcessor: VideoProcessor,
    private readonly videoRepo: VideoRepository,
    private readonly norifier: Notifier,
    private readonly organizer: BroadcastOrganizer,
    private readonly cache: Map<string, any>,
  ) {}

  getPageUpload(req: Request, res: Response) {
    if (!this.cache.has(req.params.tempId as string)) {
      return res.send("INVALID");
    }

    res.sendFile(path.join(__dirname, "../public", "index.html"));
  }

  async uploadVideo(req: Request, res: Response) {
    const { chatId, broadcast } = this.cache.get(req.params.tempId as string);
    const video = Video.create(req.file?.path!);

    this.videoProcessor.process(video, {
      onProgress: async (v, data) => {
        const match = data.match(/frame=\s*(\d+)/);
        if (match) {
          console.log(`[Video ${v.id}] Прогресс: кадр ${match[1]}`);
        }
      },
      onComplete: async (v) => {
        console.log(`[Video ${v.id}] Обработка успешно завершена`);
        v.converted();
        await this.videoRepo.save(v);
        await this.norifier.sendMessage(chatId, "Видео обработано");
        await this.organizer.scheduleBroadcast(broadcast, video);
      },
    });

    video.startProcess();
    await this.videoRepo.save(video);
    broadcast.videoId = video.id;

    res.status(200).json({message: "Видео загружено"})
  }
}
