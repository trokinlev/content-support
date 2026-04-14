import { Request, Response } from "express";
import path from "node:path";
import { Video } from "../../../domain/entities/video.entitiy";
import { VideoRepository } from "../../../domain/repositories/video.repository";
import { BroadcastRepository } from "../../../domain/repositories/broadcast.repository";

export class UploadController {
  constructor(
    private readonly cache: Map<string, any>,
    private readonly videoRepo: VideoRepository,
    private readonly broadcastRepo: BroadcastRepository,
  ) {}

  getPageUpload(req: Request, res: Response) {
    if (!this.cache.has(req.params.tempId as string)) {
      return res.send("INVALID");
    }

    res.sendFile(path.join(__dirname, "../public", "index.html"));
  }

  async uploadVideo(req: Request, res: Response) {
    const { userId, broadcastId, createdAt } = this.cache.get(req.params.tempId as string);

    const video = Video.create(req.file?.path!);
    await this.videoRepo.save(video);

    const broadcast = await this.broadcastRepo.findById(broadcastId);
    if (!broadcast) {
      return res.status(404).json({ message: "Broadcast not found" });
    }

    broadcast.setVideoId(video.id);
    await this.broadcastRepo.save(broadcast);

    res.status(200).json({message: "Видео загружено"})
  }
}
