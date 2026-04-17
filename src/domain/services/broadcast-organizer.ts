import { ChildProcessWithoutNullStreams } from "node:child_process";
import { Broadcast, BroadcastStatus } from "../entities/broadcast.entitiy";
import { DomainError } from "../common";
import { BroadcastRepository } from "../repositories/broadcast.repository";
import { ChannelRepository } from "../repositories/channel.repository";
import { VideoRepository } from "../repositories/video.repository";
import { Channel } from "../entities/channel.entitiy";
import { Video } from "../entities/video.entitiy";

export interface Broadcaster {
  start(
    broadcastRepo: BroadcastRepository,
    broadcast: Broadcast,
    video: Video,
    channel: Channel,
    activeStreams: Map<string, ChildProcessWithoutNullStreams>,
  ): Promise<void>;
  stop(
    broadcastId: string,
    activeStreams: Map<string, ChildProcessWithoutNullStreams>,
  ): Promise<void>;
}

export class BroadcastOrganizer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private activeStreams: Map<string, ChildProcessWithoutNullStreams> =
    new Map();

  constructor(
    private readonly broadcaster: Broadcaster,
    private readonly broadcastRepo: BroadcastRepository,
    private readonly channelRepo: ChannelRepository,
    private readonly videoRepo: VideoRepository,
  ) {}

  async restoreScheduledBroadcasts(): Promise<void> {
    const broadcasts = await this.broadcastRepo.findAll();

    // Находим все стримы со статусом SCHEDULED
    const scheduledBroadcasts = broadcasts.filter(
      (broadcast) => broadcast.status === BroadcastStatus.SCHEDULED,
    );

    for (const broadcast of scheduledBroadcasts) {
      const now = new Date();

      if (broadcast.scheduledStartTime <= now) {
        console.warn(
          `Broadcast ${broadcast.id} has scheduled time in the past, skipping restore`,
        );
        continue;
      }

      if (!broadcast.videoId) {
        console.error(
          `Broadcast ${broadcast.id} is SCHEDULED but has no videoId`,
        );
        continue;
      }

      try {
        const video = await this.videoRepo.findById(broadcast.videoId);
        const channel = await this.channelRepo.findById(broadcast.channelId);

        if (this.timers.has(broadcast.id)) {
          console.warn(
            `Timer for broadcast ${broadcast.id} already exists, skipping`,
          );
          continue;
        }

        const delay = broadcast.scheduledStartTime.getTime() - now.getTime();

        const timer = setTimeout(() => {
          broadcast.startLive();
          this.broadcastRepo.save(broadcast).catch((err) => {
            console.error(
              `Failed to update broadcast ${broadcast.id} status to LIVE:`,
              err,
            );
          });
          this.broadcaster.start(this.broadcastRepo, broadcast, video!, channel!, this.activeStreams);
        }, delay);

        this.timers.set(broadcast.id, timer);

        console.log(
          `Restored timer for broadcast ${broadcast.id}, will start in ${delay}ms`,
        );
      } catch (error) {
        console.error(`Failed to restore broadcast ${broadcast.id}:`, error);
      }
    }

    console.log(`Restored ${this.timers.size} scheduled broadcasts`);
  }

  // async restoreScheduledBroadcasts(): Promise<void> {
  //   const broadcasts = await this.broadcastRepo.getAll();
  //   const readyBroadcasts = broadcasts.filter(
  //     (broadcast) => broadcast.status === BroadcastStatus.PENDING,
  //   );

  //   for (const broadcast of readyBroadcasts) {
  //     const now = new Date();
  //     if (broadcast.scheduledFor <= now) continue;

  //     const video = await this.videoRepo.findById(broadcast.videoId!);
  //     const delay = broadcast.scheduledFor.getTime() - now.getTime();
  //     const timer = setTimeout(() => {
  //       this.goLive(broadcast, video);
  //     }, delay);

  //     this.timers.set(broadcast.id, timer);
  //   }
  // }

  async scheduleBroadcast(broadcast: Broadcast): Promise<void> {
    if (broadcast.status !== BroadcastStatus.SCHEDULED) {
      throw new DomainError(
        "Стрим не готов к трансляции. Имеет статуст " + broadcast.status,
      );
    }

    const video = await this.videoRepo.findById(broadcast.videoId!);
    const channel = await this.channelRepo.findById(broadcast.channelId);
    const otherBroadcasts = await this.broadcastRepo.findAll();

    for (const other of otherBroadcasts) {
      if (
        other.status === BroadcastStatus.AWAITING_PROCESSING ||
        other.status === BroadcastStatus.AWAITING_VIDEO ||
        other.status === BroadcastStatus.CANCELLED ||
        other.status === BroadcastStatus.COMPLETED ||
        other.status === BroadcastStatus.PROCESSING
      ) {
        continue;
      }

      if (other.id === broadcast.id) {
        continue;
      }

      if (other.scheduledStartTime === broadcast.scheduledStartTime) {
        throw new DomainError(
          "Время старта стрима совпадает для одного источника",
        );
      }

      const otherVideo = await this.videoRepo.findById(other.videoId!);

      const newStartTime = broadcast.scheduledStartTime.getTime();
      const newEndTime = newStartTime + video!.duration * 1000; // .duration переводим в ms

      const existingStartTime = other.scheduledStartTime.getTime();
      const existingEndTime = existingStartTime + otherVideo!.duration * 1000;

      if (
        this.isTimeOverlap(
          newStartTime,
          newEndTime,
          existingStartTime,
          existingEndTime,
        )
      ) {
        throw new Error(
          `Новый стрим (${broadcast.scheduledStartTime.toISOString()} - ${new Date(newEndTime).toISOString()}) ` +
            `пересекается с существующим стримом (${other.scheduledStartTime.toISOString()} - ${new Date(existingEndTime).toISOString()})`,
        );
      }
    }

    await this.broadcastRepo.save(broadcast);

    const now = new Date();
    const delay = broadcast.scheduledStartTime.getTime() - now.getTime();
    const timer = setTimeout(async () => {
      broadcast.startLive();
      await this.broadcastRepo.save(broadcast);
      this.broadcaster.start(this.broadcastRepo, broadcast, video!, channel!, this.activeStreams);
    }, delay);
    this.timers.set(broadcast.id, timer);
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

// export class BroadcastOrganizerOld {
//   private timers: Map<string, NodeJS.Timeout> = new Map();
//   private activeStreams: Map<string, ChildProcessWithoutNullStreams> =
//     new Map();

//   constructor(
//     private readonly broadcaster: Broadcaster,
//     private readonly broadcastRepo: BroadcastRepository,
//     private readonly videoRepo: VideoRepository,
//   ) {}

//   private async goLive(broadcast: Broadcast, video: Video): Promise<void> {
//     try {
//       if (this.activeStreams.has(broadcast.id)) {
//         throw new Error(`Broadcast ${broadcast.id} is already streaming`);
//       }

//       broadcast.status = BroadcastStatus.LIVE;
//       await this.broadcastRepo.save(broadcast);

//       const rtmpUrl = `${broadcast.rtpmUrl}/${broadcast.key}`;
//       const videoDir = path.dirname(video.sourcePath);
//       const videoFile = path.basename(video.sourcePath);

//       const args = [
//         "run",
//         "--rm",
//         "-v",
//         `${videoDir}:/data`,
//         "jrottenberg/ffmpeg:latest",
//         "-re",
//         "-stream_loop",
//         "-1",
//         "-i",
//         `/data/${videoFile}`,
//         "-c:v",
//         "libx264",
//         "-preset",
//         "ultrafast",
//         "-tune",
//         "zerolatency",
//         "-b:v",
//         "1000k",
//         "-minrate",
//         "1000k",
//         "-maxrate",
//         "1000k",
//         "-bufsize",
//         "2000k",
//         "-g",
//         "60",
//         "-keyint_min",
//         "60",
//         "-c:a",
//         "aac",
//         "-b:a",
//         "128k",
//         "-ar",
//         "44100",
//         "-f",
//         "flv",
//         "-flvflags",
//         "no_duration_filesize",
//         "-loglevel",
//         "warning",
//         rtmpUrl,
//       ];

//       const ffmpeg = spawn("docker", args);
//       this.activeStreams.set(broadcast.id, ffmpeg);

//       let reconnectAttempts = 0;
//       const maxReconnectAttempts = 3;

//       ffmpeg.stderr?.on("data", (data: Buffer) => {
//         const message = data.toString();
//         console.log(data.toString());

//         if (
//           message.includes("Connection refused") ||
//           message.includes("Failed to connect")
//         ) {
//           console.error(`❌ Connection error: ${message.trim()}`);

//           if (reconnectAttempts < maxReconnectAttempts) {
//             reconnectAttempts++;
//             console.log(
//               `🔄 Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`,
//             );

//             setTimeout(() => {
//               this.restartStream(broadcast, video);
//             }, 5000 * reconnectAttempts);
//           }
//         }

//         if (message.includes("error") || message.includes("Error")) {
//           console.error(`🎥 ${message.trim()}`);
//         }
//       });

//       ffmpeg.on("error", async (error) => {
//         console.error(`❌ Process error: ${error.message}`);
//         await this.handleStreamError(broadcast, error);
//       });

//       ffmpeg.on("close", async (code) => {
//         console.log(`Process closed with code ${code}`);

//         if (code === 0) {
//           await this.handleStreamComplete(broadcast);
//         } else if (reconnectAttempts >= maxReconnectAttempts) {
//           await this.handleStreamError(
//             broadcast,
//             new Error(`Max reconnection attempts reached`),
//           );
//         }
//       });

//       console.log(`✅ Broadcast ${broadcast.id} is LIVE`);
//     } catch (error) {
//       await this.handleStreamError(broadcast, error as Error);
//     }
//   }

//   async restoreScheduledBroadcasts(): Promise<void> {
//     const broadcasts = await this.broadcastRepo.getAll();
//     const readyBroadcasts = broadcasts.filter(
//       (broadcast) => broadcast.status === BroadcastStatus.PENDING,
//     );

//     for (const broadcast of readyBroadcasts) {
//       const now = new Date();
//       if (broadcast.scheduledFor <= now) continue;

//       const video = await this.videoRepo.findById(broadcast.videoId!);
//       const delay = broadcast.scheduledFor.getTime() - now.getTime();
//       const timer = setTimeout(() => {
//         this.goLive(broadcast, video);
//       }, delay);

//       this.timers.set(broadcast.id, timer);
//     }
//   }

//   async scheduleBroadcast(broadcast: Broadcast, video: Video): Promise<void> {
//     const similarBroadcasts = await this.broadcastRepo.findSimilar(broadcast);

//     for (const sb of similarBroadcasts) {
//       if (sb.scheduledFor === broadcast.scheduledFor) {
//         throw new Error("Время старта стрима совпадает для одного источника");
//       }

//       if (!sb.videoId) continue;
//       const sbVideo = await this.videoRepo.findById(sb.videoId);

//       const newStartTime = broadcast.scheduledFor.getTime();
//       const newEndTime = newStartTime + video.duration * 1000; // .duration переводим в ms

//       const existingStartTime = sb.scheduledFor.getTime();
//       const existingEndTime = existingStartTime + sbVideo.duration * 1000;

//       if (
//         this.isTimeOverlap(
//           newStartTime,
//           newEndTime,
//           existingStartTime,
//           existingEndTime,
//         )
//       ) {
//         throw new Error(
//           `Новый стрим (${broadcast.scheduledFor.toISOString()} - ${new Date(newEndTime).toISOString()}) ` +
//             `пересекается с существующим стримом (${sb.scheduledFor.toISOString()} - ${new Date(existingEndTime).toISOString()})`,
//         );
//       }
//     }

//     await this.broadcastRepo.save(broadcast);

//     const now = new Date();
//     const delay = broadcast.scheduledFor.getTime() - now.getTime();
//     const timer = setTimeout(() => {
//       this.goLive(broadcast, video);
//     }, delay);
//     this.timers.set(broadcast.id, timer);
//   }

//   private async handleStreamComplete(broadcast: Broadcast): Promise<void> {
//     broadcast.status = BroadcastStatus.ENDED;
//     await this.broadcastRepo.save(broadcast);
//     this.activeStreams.delete(broadcast.id);
//     this.timers.delete(broadcast.id);
//     console.log(`🏁 Broadcast ${broadcast.id} ended successfully`);
//   }

//   private async handleStreamError(
//     broadcast: Broadcast,
//     error: Error,
//   ): Promise<void> {
//     broadcast.status = BroadcastStatus.ENDED;
//     await this.broadcastRepo.save(broadcast);
//     this.activeStreams.delete(broadcast.id);
//     this.timers.delete(broadcast.id);
//     console.error(`💀 Broadcast ${broadcast.id} failed: ${error.message}`);
//   }

//   private async restartStream(
//     broadcast: Broadcast,
//     video: Video,
//   ): Promise<void> {
//     const oldProcess = this.activeStreams.get(broadcast.id);
//     if (oldProcess) {
//       oldProcess.kill("SIGKILL");
//       this.activeStreams.delete(broadcast.id);
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//       await this.goLive(broadcast, video);
//     }
//   }

//   // Проверка на пересечение интервалов
//   private isTimeOverlap(
//     start1: number,
//     end1: number,
//     start2: number,
//     end2: number,
//   ): boolean {
//     return Math.max(start1, start2) < Math.min(end1, end2);
//   }
// }
