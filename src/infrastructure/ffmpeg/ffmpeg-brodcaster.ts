import path from "node:path";
import { Broadcaster } from "../../domain/services/broadcast-organizer";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { Channel } from "../../domain/entities/channel.entitiy";
import { Video } from "../../domain/entities/video.entitiy";
import { Broadcast } from "../../domain/entities/broadcast.entitiy";
import { BroadcastRepository } from "../../domain/repositories/broadcast.repository";

export class FFmpegBrodcaster implements Broadcaster {
  async start(
    bradcastRepo: BroadcastRepository,
    broadcast: Broadcast,
    video: Video,
    channel: Channel,
    activeStreams: Map<string, ChildProcessWithoutNullStreams>,
  ): Promise<void> {
    const videoDir = path.dirname(video.formattedPath!);
    const videoFile = path.basename(video.formattedPath!);

    const args = [
      "run",
      "--rm",
      "-v",
      `${videoDir}:/data`,
      "jrottenberg/ffmpeg:latest",
      "-re",
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
      channel.rtmpUrl + channel.key,
    ];

    const videoDurationMs = video.duration * 1000;

    const timeout = setTimeout(async () => {
      console.log(`Video duration reached, stopping broadcast ${broadcast.id}`);
      broadcast.complete();
      await bradcastRepo.save(broadcast);
      ffmpeg.kill("SIGTERM");
    }, videoDurationMs);


    const ffmpeg = spawn("docker", args);

    ffmpeg.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      console.log(message);
    });

    ffmpeg.on("error", async (error) => {
      console.error(`Process error: ${error.message}`);
    });

    ffmpeg.on("close", async (code) => {
      clearTimeout(timeout);
      activeStreams.delete(broadcast.id);

      broadcast.complete();
      await bradcastRepo.save(broadcast);
      console.log(`Process closed with code ${code}`);
    });

    activeStreams.set(broadcast.id, ffmpeg);
  }

  async stop(
    broadcastId: string,
    activeStreams: Map<string, ChildProcessWithoutNullStreams>,
  ): Promise<void> {
    const ffmpeg = activeStreams.get(broadcastId);
    if (ffmpeg) {
      ffmpeg.kill("SIGTERM");
      activeStreams.delete(broadcastId);
    }
  }
}