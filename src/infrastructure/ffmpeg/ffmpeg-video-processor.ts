import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { videoDuration } from "@numairawan/video-duration";
import { Video } from "../../domain/entities/video.entitiy";

export class FFmpegVideoProcessor {
  private blackStartSeconds = 10;
  private blackEndSeconds = 30;

  async process(
    video: Video,
    callbacks?: {
      onComplete?: (video: Video) => void;
      onProgress?: (video: Video, data: string) => void;
    },
  ): Promise<void> {
    const inputPath = path.resolve(video.originalPath);
    const outputPath = path.resolve(path.join(process.env.OUTPUT_DIR!, path.basename(video.originalPath)));

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const inputDir = path.dirname(inputPath);
    const outputDir = path.dirname(outputPath);
    const inputFile = path.basename(inputPath);
    const outputFile = path.basename(outputPath);

    const videoInfo = await this.getVideoInfo(inputPath);
    const { width, height, fps } = videoInfo;

    const args = [
      "run",
      "--rm",
      "-v",
      `${inputDir}:/input`,
      "-v",
      `${outputDir}:/output`,
      "jrottenberg/ffmpeg:latest",

      "-i",
      `/input/${inputFile}`,

      "-filter_complex",
      `
  [0:v]setpts=PTS-STARTPTS,format=yuv420p[v_main];
  [0:a]asetpts=PTS-STARTPTS[a_main];

  color=c=black:s=${width}x${height}:r=${fps}:d=${this.blackStartSeconds},format=yuv420p[v0];
  anullsrc=r=44100:cl=stereo:duration=${this.blackStartSeconds}[a0];

  color=c=black:s=${width}x${height}:r=${fps}:d=${this.blackEndSeconds},format=yuv420p[v2];
  anullsrc=r=44100:cl=stereo:duration=${this.blackEndSeconds}[a2];

  [v0][a0][v_main][a_main][v2][a2]concat=n=3:v=1:a=1[v][a]
  `,

      "-map",
      "[v]",
      "-map",
      "[a]",

      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",

      "-c:a",
      "aac",
      "-b:a",
      "128k",

      "-movflags",
      "+faststart",

      "-y",
      `/output/${outputFile}`,
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("docker", args);
      let progressOutput = "";

      const onStderr = (data: Buffer) => {
        const message = data.toString();
        progressOutput += message;
        callbacks?.onProgress?.(video, message);
      };

      const onError = (err: Error) => {
        cleanup();

        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }

        reject(err);
      };

      const onClose = (code: number) => {
        cleanup();

        if (code === 0) {
          this.getDuration(outputPath)
            .then((duration) => {
              video.setDuration(duration);
              video.setFormattedPath(outputPath);
              resolve();
              callbacks?.onComplete?.(video);
            })
            .catch((err) => {
              reject(new Error(`Failed to get video duration: ${err.message}`));
            });
        } else {
          reject(
            new Error(`FFmpeg exited with code ${code}: ${progressOutput}`),
          );
        }
      };

      const cleanup = () => {
        ffmpeg.stderr.off("data", onStderr);
        ffmpeg.off("error", onError);
        ffmpeg.off("close", onClose);
      };

      ffmpeg.stderr.on("data", onStderr);
      ffmpeg.on("error", onError);
      ffmpeg.on("close", onClose);
    });
  }

  async getDuration(videoPath: string): Promise<number> {
    const duration = (await videoDuration(videoPath)) as any;
    return duration.seconds;
  }

  async getVideoInfo(
    videoPath: string,
  ): Promise<{ width: number; height: number; fps: number }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn("docker", [
        "run",
        "--rm",
        "--entrypoint",
        "ffprobe",
        "-v",
        `${path.dirname(videoPath)}:/video`,
        "jrottenberg/ffmpeg:latest",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate",
        "-of",
        "default=noprint_wrappers=1",
        `/video/${path.basename(videoPath)}`,
      ]);

      let output = "";
      let error = "";

      ffprobe.stdout.on("data", (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        error += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code === 0) {
          const lines = output.split("\n");
          let width = 0;
          let height = 0;
          let fps = 30; // значение по умолчанию

          for (const line of lines) {
            if (line.startsWith("width=")) {
              width = parseInt(line.split("=")[1]);
            } else if (line.startsWith("height=")) {
              height = parseInt(line.split("=")[1]);
            } else if (line.startsWith("r_frame_rate=")) {
              const fpsFraction = line.split("=")[1];
              const [num, den] = fpsFraction.split("/");
              fps = Math.round(parseInt(num) / parseInt(den));
            }
          }

          if (width === 0 || height === 0) {
            reject(new Error("Could not determine video dimensions"));
          } else {
            resolve({ width, height, fps });
          }
        } else {
          reject(new Error(`FFprobe failed: ${error}`));
        }
      });
    });
  }
}
