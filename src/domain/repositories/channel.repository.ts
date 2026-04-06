import { Channel } from "../entities/channel.entitiy";

export interface ChannelRepository {
  findAll(): Promise<Channel[]>;
  findById(id: string): Promise<Channel | null>;
  save(channel: Channel): Promise<void>;
}