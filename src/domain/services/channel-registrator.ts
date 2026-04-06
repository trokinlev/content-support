import { Channel } from "../entities/channel.entitiy";
import { ChannelRepository } from "../repositories/channel.repository";

export class ChannelRegistrator {
  constructor(private readonly channelRepo: ChannelRepository) {}

  async register(title: string, rtmpUrl: string, key: string): Promise<Channel> {
    const channel = Channel.create(title, rtmpUrl, key);
    await this.channelRepo.save(channel);

    return channel;
  }
}