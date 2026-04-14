import { Video } from "../entities/video.entitiy";

export interface VideoRepository {
  findById(id: string): Promise<Video | null>;
  save(video: Video): Promise<void>;
}