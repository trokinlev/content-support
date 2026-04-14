import { Collection, Db } from "mongodb";
import { Video } from "../../../domain/entities/video.entitiy";
import { VideoRepository } from "../../../domain/repositories/video.repository";

export class MongodbVideoRepository implements VideoRepository {
  private collection: Collection;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection("videos");
  }

  async findById(id: string): Promise<Video | null> {
    const document = await this.collection.findOne({ id: id });
    if (!document) return null;

    return Video.restore(
      document.id,
      document.originalPath,
      document.formattedPath,
      document.duration,
      document.createdAt,
      document.updatedAt,
    );
  }

  async save(video: Video): Promise<void> {
    const exists = await this.collection.findOne({ id: video.id });

    if (exists) {
      await this.collection.updateOne(
        { id: video.id },
        {
          $set: {
            id: video.id,
            originalPath: video.originalPath,
            formattedPath: video.formattedPath,
            duration: video.duration,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await this.collection.insertOne({
        id: video.id,
        originalPath: video.originalPath,
        formattedPath: video.formattedPath,
        duration: video.duration,
        updatedAt: video.updatedAt,
        createdAt: video.createdAt,
      });
    }
  }
}
