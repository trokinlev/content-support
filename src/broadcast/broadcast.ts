import { Collection, Db } from "mongodb";
import { randomUUID, UUID } from "node:crypto";

export interface Notifier {
  sendMessage(chatId: number, message: string): Promise<void>;
}

export enum BroadcastStatus {
  PENDING = "PENDING",
  LIVE = "LIVE",
  PAUSED = "PAUSED",
  ENDED = "ENDED",
  CREATING = "CREATING",
}

export class Broadcast {
  constructor(
    private readonly _id: UUID,
    private _videoId: UUID | null,
    private _status: BroadcastStatus,
    private _title: string,
    private _scheduledFor: Date,
    private _rtpmUrl: string,
    private _key: string,
  ) {}

  static create(props: {
    title: string;
    scheduledFor: Date;
    rtpmUrl: string;
    key: string;
  }): Broadcast {
    return new Broadcast(
      randomUUID(),
      null,
      BroadcastStatus.CREATING,
      props.title,
      props.scheduledFor,
      props.rtpmUrl,
      props.key,
    );
  }

  get id(): UUID {
    return this._id;
  }

  get status(): BroadcastStatus {
    return this._status;
  }
  set status(value: BroadcastStatus) {
    this._status = value;
  }

  get title(): string {
    return this._title;
  }

  get rtpmUrl(): string {
    return this._rtpmUrl;
  }

  get key(): string {
    return this._key;
  }

  get scheduledFor(): Date {
    return this._scheduledFor;
  }

  get videoId(): UUID | null {
    return this._videoId;
  }

  set videoId(id: UUID | string | null) {
    if (!id) {
      this._videoId = null;
      return;
    }

    this._videoId = id as UUID;
  }
}

export interface BroadcastRepository {
  getAll(): Promise<Broadcast[]>;
  findById(id: UUID): Promise<Broadcast>;
  findSimilar(broadcast: Broadcast): Promise<Broadcast[]>
  save(broadcast: Broadcast): Promise<void>;
}

export class MongodbBroadcastRepository implements BroadcastRepository {
  private collection: Collection;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection("broadcasts");
  }

  async getAll(): Promise<Broadcast[]> {
    const documents = await this.collection.find({}).toArray();

    return documents.map((doc) => {
      return new Broadcast(
        doc.id,
        doc.videoId,
        doc.status,
        doc.title,
        new Date(doc.scheduledFor),
        doc.rtpmUrl,
        doc.key,
      );
    });
  }

  async findById(id: UUID): Promise<Broadcast> {
    const document = await this.collection.findOne({ id });
    if (!document) throw new Error("NOT_FOUND");

    return new Broadcast(
      document.id,
      document.videoId,
      document.status,
      document.title,
      document.scheduledFor,
      document.rtpmUrl,
      document.key,
    );
  }

  async findSimilar(broadcast: Broadcast): Promise<Broadcast[]> {
    const documents = await this.collection
      .find({
        rtpmUrl: broadcast.rtpmUrl,
        key: broadcast.key,
      })
      .toArray();

    return documents.map(
      (doc) =>
        new Broadcast(
          doc.id,
          doc.videoId,
          doc.status,
          doc.title,
          doc.scheduledFor,
          doc.rtpmUrl,
          doc.key,
        ),
    );
  }

  async save(broadcast: Broadcast): Promise<void> {
    const exists = await this.collection.findOne({ id: broadcast.id });

    if (exists) {
      await this.collection.updateOne(
        { id: broadcast.id },
        {
          $set: {
            videoId: broadcast.videoId,
            title: broadcast.title,
            status: broadcast.status,
            scheduledFor: broadcast.scheduledFor,
            rtpmUrl: broadcast.rtpmUrl,
            key: broadcast.key,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await this.collection.insertOne({
        id: broadcast.id,
        videoId: broadcast.videoId,
        title: broadcast.title,
        status: broadcast.status,
        scheduledFor: broadcast.scheduledFor,
        rtpmUrl: broadcast.rtpmUrl,
        key: broadcast.key,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}