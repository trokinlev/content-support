import { spawn } from "node:child_process";
import { randomUUID, UUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { Collection, Db } from "mongodb";
import { videoDuration } from "@numairawan/video-duration";

export class Video {
  constructor(
    private readonly _id: UUID,
    private _sourcePath: string,
    private _isConverted: boolean,
    private _isProcessed: boolean,
    private _created_at: Date,
    private _duration: number,
  ) {}

  static create(sourcePath: string): Video {
    return new Video(randomUUID(), sourcePath, false, false, new Date(), 0);
  }

  get id(): UUID {
    return this._id;
  }

  get sourcePath(): string {
    return this._sourcePath;
  }

  get isConverted(): boolean {
    return this._isConverted;
  }

  get isProcessed(): boolean {
    return this._isProcessed;
  }

  get createdAt(): Date {
    return this._created_at;
  }

  get filename(): string {
    return path.basename(this._sourcePath);
  }

  get duration(): number {
    return this._duration;
  }

  set duration(value: number) {
    this._duration = value;
  }

  converted() {
    if (fs.existsSync(this._sourcePath)) {
      // console.log(this._sourcePath)
      // fs.unlinkSync(this._sourcePath);
    }

    this._isConverted = true;
    this._isProcessed = false;
    this._sourcePath = path.resolve(
      path.join(process.env.OUTPUT_DIR!, this.filename),
    );
  }

  startProcess(): void {
    this._isProcessed = true;
  }
}

export interface VideoProcessor {
  process(
    video: Video,
    callbacks?: {
      onComplete?: (video: Video) => void;
      onProgress?: (video: Video, data: string) => void;
    },
  ): void;
  getDuration(videoPath: string): Promise<number>;
}

export class FFmpegVideoProcessor implements VideoProcessor {
  private targetWidth = 1280;
  private targetHeight = 720;
  private targetFps = 30;
  private targetDuration = 300;

  async process(
    video: Video,
    callbacks?: {
      onComplete?: (video: Video) => void;
      onProgress?: (video: Video, data: string) => void;
    },
  ): Promise<void> {
    const inputPath = path.resolve(video.sourcePath);
    const outputPath = path.resolve(
      path.join(process.env.OUTPUT_DIR!, video.filename),
    );

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const inputDir = path.dirname(inputPath);
    const outputDir = path.dirname(outputPath);
    const inputFile = path.basename(inputPath);
    const outputFile = path.basename(outputPath);

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
      "-f",
      "lavfi",
      "-t",
      this.targetDuration.toString(),
      "-i",
      `color=c=black:s=${this.targetWidth}x${this.targetHeight}:r=${this.targetFps}`,
      "-f",
      "lavfi",
      "-t",
      this.targetDuration.toString(),
      "-i",
      "anullsrc=r=44100:cl=stereo",
      "-filter_complex",
      `[0:v]fps=${this.targetFps},scale=${this.targetWidth}:${this.targetHeight}:force_original_aspect_ratio=1,pad=${this.targetWidth}:${this.targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,setpts=PTS-STARTPTS,format=yuv420p[v0];` +
        `[0:a]aresample=44100,asetpts=PTS-STARTPTS[a0];` +
        `[1:v]setpts=PTS-STARTPTS,format=yuv420p[v1];` +
        `[2:a]asetpts=PTS-STARTPTS[a1];` +
        `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
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
          console.log(outputPath)
          fs.unlinkSync(outputPath);
        }

        reject(err);
      };

      const onClose = (code: number) => {
        cleanup();

        if (code === 0) {
          this.getDuration(outputPath)
            .then((duration) => {
              video.duration = duration;
              video.converted();
              video.startProcess();
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
    const duration = await videoDuration(videoPath) as any;
    return duration.seconds;
  }
}

export interface VideoRepository {
  save(video: Video): Promise<void>;
  findById(id: UUID | string): Promise<Video>;
}

export class MongodbVideoRepository implements VideoRepository {
  private collection: Collection;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection("videos");
  }

  async findById(id: UUID | string): Promise<Video> {
    const document = await this.collection.findOne({ id });
    if (!document) throw new Error("NOT_FOUND");

    return new Video(
      document.id,
      document.sourcePath,
      document.isConverted,
      document.isProcessed,
      document.createdAt,
      document.duration,
    );
  }

  async save(video: Video): Promise<void> {
    const exists = await this.collection.findOne({ id: video.id });

    if (exists) {
      await this.collection.updateOne(
        { id: video.id },
        {
          $set: {
            sourcePath: video.sourcePath,
            isConverted: video.isConverted,
            isProcessed: video.isProcessed,
            duration: video.duration,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await this.collection.insertOne({
        id: video.id,
        sourcePath: video.sourcePath,
        isConverted: video.isConverted,
        isProcessed: video.isProcessed,
        duration: video.duration,
        createdAt: video.createdAt,
        updatedAt: video.createdAt,
      });
    }
  }
}
