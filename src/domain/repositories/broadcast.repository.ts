import { Broadcast } from "../entities/broadcast.entitiy";

export interface BroadcastRepository {
  findAll(): Promise<Broadcast[]>;
  findById(broadcastId: string): Promise<Broadcast | null>;
  save(broadcast: Broadcast): Promise<void>;
}