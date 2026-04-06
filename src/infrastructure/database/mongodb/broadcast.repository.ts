import { Collection, Db, Filter } from "mongodb";
import { Broadcast, BroadcastStatus } from "../../../domain/entities/broadcast.entitiy";
import { BroadcastRepository } from "../../../domain/repositories/broadcast.repository";

interface BroadcastDocument {
  id: string;
  ownerId: string;
  channelId: string;
  videoId: string | null;
  status: BroadcastStatus;
  scheduledStartTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class MongodbBroadcastRepository implements BroadcastRepository {
  private collection: Collection<BroadcastDocument>;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection<BroadcastDocument>("broadcasts");
  }

  async findAll(): Promise<Broadcast[]> {
    const documents = await this.collection.find({}).toArray();
    return documents.map((doc) => this.toDomain(doc));
  }

  async findById(broadcastId: string): Promise<Broadcast | null> {
    const document = await this.collection.findOne({ id: broadcastId });
    return document ? this.toDomain(document) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Broadcast[]> {
    const documents = await this.collection.find({ ownerId }).toArray();
    return documents.map((doc) => this.toDomain(doc));
  }

  async findByChannelId(channelId: string): Promise<Broadcast[]> {
    const documents = await this.collection.find({ channelId }).toArray();
    return documents.map((doc) => this.toDomain(doc));
  }

  async findByStatus(status: BroadcastStatus): Promise<Broadcast[]> {
    const documents = await this.collection.find({ status }).toArray();
    return documents.map((doc) => this.toDomain(doc));
  }

  async findScheduledBroadcasts(fromDate?: Date): Promise<Broadcast[]> {
    const query: Filter<BroadcastDocument> = {
      status: BroadcastStatus.SCHEDULED,
      scheduledStartTime: { $gte: fromDate || new Date() },
    };

    const documents = await this.collection
      .find(query)
      .sort({ scheduledStartTime: 1 })
      .toArray();

    return documents.map((doc) => this.toDomain(doc));
  }

  async findActiveBroadcasts(): Promise<Broadcast[]> {
    const activeStatuses = [
      BroadcastStatus.AWAITING_VIDEO,
      BroadcastStatus.AWAITING_PROCESSING,
      BroadcastStatus.PROCESSING,
      BroadcastStatus.SCHEDULED,
      BroadcastStatus.LIVE,
    ];

    const documents = await this.collection
      .find({ status: { $in: activeStatuses } })
      .toArray();

    return documents.map((doc) => this.toDomain(doc));
  }

  async save(broadcast: Broadcast): Promise<void> {
    const document = this.toDocument(broadcast);
    const exists = await this.collection.findOne({ id: broadcast.id });

    if (exists) {
      await this.collection.updateOne(
        { id: broadcast.id },
        {
          $set: {
            videoId: document.videoId,
            status: document.status,
            scheduledStartTime: document.scheduledStartTime,
            updatedAt: document.updatedAt,
          },
        },
      );
    } else {
      await this.collection.insertOne(document);
    }
  }

  async delete(broadcastId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ id: broadcastId });
    return result.deletedCount === 1;
  }

  async updateStatus(
    broadcastId: string,
    status: BroadcastStatus,
    updatedAt: Date,
  ): Promise<void> {
    const result = await this.collection.updateOne(
      { id: broadcastId },
      {
        $set: {
          status,
          updatedAt,
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error(`Broadcast with id ${broadcastId} not found`);
    }
  }

  private toDomain(document: BroadcastDocument): Broadcast {
    return Broadcast.restore({
      id: document.id,
      ownerId: document.ownerId,
      channelId: document.channelId,
      videoId: document.videoId,
      status: document.status,
      scheduledStartTime: document.scheduledStartTime,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  private toDocument(broadcast: Broadcast): BroadcastDocument {
    return {
      id: broadcast.id,
      ownerId: broadcast.ownerId,
      channelId: broadcast.channelId,
      videoId: broadcast.videoId,
      status: broadcast.status,
      scheduledStartTime: broadcast.scheduledStartTime,
      createdAt: broadcast.createdAt,
      updatedAt: broadcast.updatedAt,
    };
  }
}
