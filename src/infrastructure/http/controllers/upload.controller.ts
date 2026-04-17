import { Request, Response } from "express";
import path from "node:path";
import { Video } from "../../../domain/entities/video.entitiy";
import { VideoRepository } from "../../../domain/repositories/video.repository";
import { BroadcastRepository } from "../../../domain/repositories/broadcast.repository";
import { FFmpegVideoProcessor } from "../../ffmpeg/ffmpeg-video-processor";
import { BroadcastStatus } from "../../../domain/entities/broadcast.entitiy";
import { BroadcastOrganizer } from "../../../domain/services/broadcast-organizer";

export class UploadController {
  constructor(
    private readonly cache: Map<string, any>,
    private readonly videoRepo: VideoRepository,
    private readonly broadcastRepo: BroadcastRepository,
    private readonly videoProcessor: FFmpegVideoProcessor,
    private readonly broadcastOrganizer: BroadcastOrganizer,
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

    this.videoProcessor.process(video, {
      onProgress: async (processedVideo, data) => {
        if (broadcast.status !== BroadcastStatus.PROCESSING) {
          broadcast.startProcessing();
          await this.broadcastRepo.save(broadcast);
        }

        console.log(`Processing video ${processedVideo.id}: ${data}`);
      },
      onComplete: async (processedVideo) => {
        await this.videoRepo.save(processedVideo);

        broadcast.completeProcessing();
        await this.broadcastRepo.save(broadcast);

        await this.broadcastOrganizer.scheduleBroadcast(broadcast);
        console.log(`Video ${processedVideo.id} processing complete`);
      },
    }).catch((err) => {
      console.error("Error processing video:", err);
    });

    res.status(200).json({message: "Видео загружено"})
  }
}
