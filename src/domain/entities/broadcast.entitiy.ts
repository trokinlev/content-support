import { randomUUID } from "node:crypto";
import { DomainError } from "../common";

export enum BroadcastStatus {
  /**
   * Ожидает загрузки видео
   * 
   * Broadcast создан, но видео ещё не загружено.
   */
  AWAITING_VIDEO = "awaiting_video",

  /**
   * Ожидает обработки видео
   *
   * Видео загружено и поставлено в очередь на транскодирование.
   */
  AWAITING_PROCESSING = "awaiting_processing",

  /**
   * Запланирован
   *
   * Видео успешно обработано и готово к публикации.
   * Broadcast ждёт запланированного пользователем времени старта.
   */
  SCHEDULED = "scheduled",

  /**
   * В эфире
   *
   * Трансляция идёт прямо сейчас.
   */
  LIVE = "live",

  /**
   * Завершён
   *
   * Трансляция штатно завершилась.
   * Видео до конца отправлено в канал.
   * Это финальный статус, никакие действия больше не доступны.
   */
  COMPLETED = "completed",

  /**
   * Отменён
   *
   * Трансляция отменена пользователем.
   * Можно отменить на любом этапе до начала трансляции.
   * Это финальный статус, восстановление невозможно.
   */
  CANCELLED = "cancelled",
}

export class Broadcast {
  private constructor(
    private readonly _id: string,
    private readonly _ownerId: string,
    private readonly _channelId: string,
    private _videoId: string | null,
    private _status: BroadcastStatus,
    private _scheduledStartTime: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(props: {
    ownerId: string;
    channelId: string;
    scheduledStartTime: Date;
  }): Broadcast {
    const now = new Date();

    if (props.scheduledStartTime <= now) {
      throw new DomainError("Scheduled start time cannot be in the past");
    }

    return new Broadcast(
      randomUUID(),
      props.ownerId,
      props.channelId,
      null,
      BroadcastStatus.AWAITING_VIDEO,
      props.scheduledStartTime,
      now,
      now,
    );
  }

  get id(): string {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get channelId(): string {
    return this._channelId;
  }
  get scheduledStartTime(): Date {
    return this._scheduledStartTime;
  }
  get videoId(): string | null {
    return this._videoId;
  }
  get status(): BroadcastStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
