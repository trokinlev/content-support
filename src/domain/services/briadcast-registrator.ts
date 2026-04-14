import { Broadcast } from "../entities/broadcast.entitiy";
import { User } from "../entities/user.entitiy";
import { BroadcastRepository } from "../repositories/broadcast.repository";

export class BroadcastRegistrator {
  constructor(private readonly broadcastRepo: BroadcastRepository) {}

  async register(broadcast: Broadcast, owner: User): Promise<void> {
    const broadcasts = await this.broadcastRepo.findAll();
  }
}