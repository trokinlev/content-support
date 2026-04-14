import path from "node:path";
import { Broadcaster } from "../../domain/services/broadcast-organizer";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { Channel } from "../../domain/entities/channel.entitiy";
import { Video } from "../../domain/entities/video.entitiy";
import { Broadcast } from "../../domain/entities/broadcast.entitiy";

export class FFmpegBrodcaster implements Broadcaster {
  async start(broadcast: Broadcast, video: Video, channel: Channel, activeStreams: Map<string, ChildProcessWithoutNullStreams>): Promise<void> {
    const videoDir = path.dirname(video.formattedPath!);
    const videoFile = path.basename(video.formattedPath!);

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
      channel.rtmpUrl + channel.key,
    ];

    const ffmpeg = spawn("docker", args);

    ffmpeg.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      console.log(message);
    });

    ffmpeg.on("error", async (error) => {
      console.error(`Process error: ${error.message}`);
    });

    ffmpeg.on("close", async (code) => {
      console.log(`Process closed with code ${code}`);
    });

    activeStreams.set(broadcast.id, ffmpeg);
  }

  async stop(): Promise<void> {}
}