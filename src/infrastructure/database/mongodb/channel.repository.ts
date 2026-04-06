import { Collection, Db } from "mongodb";
import { Channel } from "../../../domain/entities/channel.entitiy";
import { ChannelRepository } from "../../../domain/repositories/channel.repository";

export class MongodbChannelRepository implements ChannelRepository {
  private collection: Collection;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection("channels");
  }

  async findAll(): Promise<Channel[]> {
    const documents = await this.collection.find({}).toArray();

    return documents.map((doc) =>
      Channel.restore(doc.id, doc.title, doc.rtmpUrl, doc.key),
    );
  }

  async findById(id: string): Promise<Channel | null> {
    const document = await this.collection.findOne({ id: id });
    if (!document) return null;

    return Channel.restore(
      document.id,
      document.title,
      document.rtmpUrl,
      document.key,
    );
  }

  async save(channel: Channel): Promise<void> {
    const exists = await this.collection.findOne({ id: channel.id });

    if (exists) {
      await this.collection.updateOne(
        { id: channel.id },
        {
          $set: {
            id: channel.id,
            title: channel.title,
            rtmpUrl: channel.rtmpUrl,
            key: channel.key,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await this.collection.insertOne({
        id: channel.id,
        title: channel.title,
        rtmpUrl: channel.rtmpUrl,
        key: channel.key,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}
