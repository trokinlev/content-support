import path from "node:path";
import { Video, VideoRepository } from "../video";
import { Broadcast, BroadcastRepository, BroadcastStatus } from "./broadcast";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";

export class BroadcastOrganizer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private activeStreams: Map<string, ChildProcessWithoutNullStreams> =
    new Map();

  constructor(
    private readonly broadcastRepo: BroadcastRepository,
    private readonly videoRepo: VideoRepository,
  ) {}

  private async goLive(broadcast: Broadcast, video: Video): Promise<void> {
    try {
      if (this.activeStreams.has(broadcast.id)) {
        throw new Error(`Broadcast ${broadcast.id} is already streaming`);
      }

      broadcast.status = BroadcastStatus.LIVE;
      await this.broadcastRepo.save(broadcast);

      const rtmpUrl = `${broadcast.rtpmUrl}/${broadcast.key}`;
      const videoDir = path.dirname(video.sourcePath);
      const videoFile = path.basename(video.sourcePath);

      const args = [
        "run",
        "--rm",
        "-v",
        `${videoDir}:/data`,
        "jrottenberg/ffmpeg:latest",
        "-re",
        "-stream_loop",
        "-1",
        "-i",
        `/data/${videoFile}`,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-b:v",
        "1000k",
        "-minrate",
        "1000k",
        "-maxrate",
        "1000k",
        "-bufsize",
        "2000k",
        "-g",
        "60",
        "-keyint_min",
        "60",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-f",
        "flv",
        "-flvflags",
        "no_duration_filesize",
        "-loglevel",
        "warning",
        rtmpUrl,
      ];

      const ffmpeg = spawn("docker", args);
      this.activeStreams.set(broadcast.id, ffmpeg);

      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;

      ffmpeg.stderr?.on("data", (data: Buffer) => {
        const message = data.toString();
        console.log(data.toString())

        if (
          message.includes("Connection refused") ||
          message.includes("Failed to connect")
        ) {
          console.error(`❌ Connection error: ${message.trim()}`);

          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(
              `🔄 Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`,
            );

            setTimeout(() => {
              this.restartStream(broadcast, video);
            }, 5000 * reconnectAttempts);
          }
        }

        if (message.includes("error") || message.includes("Error")) {
          console.error(`🎥 ${message.trim()}`);
        }
      });

      ffmpeg.on("error", async (error) => {
        console.error(`❌ Process error: ${error.message}`);
        await this.handleStreamError(broadcast, error);
      });

      ffmpeg.on("close", async (code) => {
        console.log(`Process closed with code ${code}`);

        if (code === 0) {
          await this.handleStreamComplete(broadcast);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          await this.handleStreamError(
            broadcast,
            new Error(`Max reconnection attempts reached`),
          );
        }
      });

      console.log(`✅ Broadcast ${broadcast.id} is LIVE`);
    } catch (error) {
      await this.handleStreamError(broadcast, error as Error);
    }
  }

  async restoreScheduledBroadcasts(): Promise<void> {
    const broadcasts = await this.broadcastRepo.getAll();
    const readyBroadcasts = broadcasts.filter(
      (broadcast) => broadcast.status === BroadcastStatus.PENDING,
    );

    for (const broadcast of readyBroadcasts) {
      const now = new Date();
      if (broadcast.scheduledFor <= now) continue;

      const video = await this.videoRepo.findById(broadcast.videoId!);
      const delay = broadcast.scheduledFor.getTime() - now.getTime();
      const timer = setTimeout(() => {
        this.goLive(broadcast, video);
      }, delay);

      this.timers.set(broadcast.id, timer);
    }
  }

  async scheduleBroadcast(broadcast: Broadcast, video: Video): Promise<void> {
    const similarBroadcasts = await this.broadcastRepo.findSimilar(broadcast);

    for (const sb of similarBroadcasts) {
      if (sb.scheduledFor === broadcast.scheduledFor) {
        throw new Error("Время старта стрима совпадает для одного источника");
      }

      if (!sb.videoId) continue;
      const sbVideo = await this.videoRepo.findById(sb.videoId);

      const newStartTime = broadcast.scheduledFor.getTime();
      const newEndTime = newStartTime + video.duration * 1000; // .duration переводим в ms

      const existingStartTime = sb.scheduledFor.getTime();
      const existingEndTime = existingStartTime + sbVideo.duration * 1000;

      if (
        this.isTimeOverlap(
          newStartTime,
          newEndTime,
          existingStartTime,
          existingEndTime,
        )
      ) {
        throw new Error(
          `Новый стрим (${broadcast.scheduledFor.toISOString()} - ${new Date(newEndTime).toISOString()}) ` +
            `пересекается с существующим стримом (${sb.scheduledFor.toISOString()} - ${new Date(existingEndTime).toISOString()})`,
        );
      }
    }

    await this.broadcastRepo.save(broadcast);

    const now = new Date();
    const delay = broadcast.scheduledFor.getTime() - now.getTime();
    const timer = setTimeout(() => {
      this.goLive(broadcast, video);
    }, delay);
    this.timers.set(broadcast.id, timer);
  }

  private async handleStreamComplete(broadcast: Broadcast): Promise<void> {
    broadcast.status = BroadcastStatus.ENDED;
    await this.broadcastRepo.save(broadcast);
    this.activeStreams.delete(broadcast.id);
    this.timers.delete(broadcast.id);
    console.log(`🏁 Broadcast ${broadcast.id} ended successfully`);
  }

  private async handleStreamError(
    broadcast: Broadcast,
    error: Error,
  ): Promise<void> {
    broadcast.status = BroadcastStatus.ENDED;
    await this.broadcastRepo.save(broadcast);
    this.activeStreams.delete(broadcast.id);
    this.timers.delete(broadcast.id);
    console.error(`💀 Broadcast ${broadcast.id} failed: ${error.message}`);
  }

  private async restartStream(
    broadcast: Broadcast,
    video: Video,
  ): Promise<void> {
    const oldProcess = this.activeStreams.get(broadcast.id);
    if (oldProcess) {
      oldProcess.kill("SIGKILL");
      this.activeStreams.delete(broadcast.id);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await this.goLive(broadcast, video);
    }
  }

  // Проверка на пересечение интервалов
  private isTimeOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return Math.max(start1, start2) < Math.min(end1, end2);
  }
}
