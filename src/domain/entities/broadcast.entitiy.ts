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
   * Видео обрабатывается
   *
   * Видео загружено и в процессе обработки.
   */
  PROCESSING = "processing",

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

  static restore(props: {
    id: string;
    ownerId: string;
    channelId: string;
    videoId: string | null;
    status: BroadcastStatus;
    scheduledStartTime: Date;
    createdAt: Date;
    updatedAt: Date;
  }): Broadcast {
    return new Broadcast(
      props.id,
      props.ownerId,
      props.channelId,
      props.videoId,
      props.status,
      props.scheduledStartTime,
      props.createdAt,
      props.updatedAt,
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

  completeProcessing(): void {
    if (this._status !== BroadcastStatus.PROCESSING) {
      throw new DomainError(
        `Cannot complete processing from status: ${this._status}`,
      );
    }

    this._status = BroadcastStatus.SCHEDULED;
    this._updatedAt = new Date();
  }

  startLive(): void {
    if (this._status !== BroadcastStatus.SCHEDULED) {
      throw new DomainError(`Cannot start live from status: ${this._status}`);
    }

    // if (new Date() < this._scheduledStartTime) {
    //   throw new DomainError("Cannot start live before scheduled time");
    // }

    this._status = BroadcastStatus.LIVE;
    this._updatedAt = new Date();
  }

  startProcessing(): void {
    const allowedStatuses = [BroadcastStatus.AWAITING_PROCESSING];

    if (!allowedStatuses.includes(this._status)) {
      throw new DomainError(
        `Cannot start processing when broadcast is in status: ${this._status}. ` +
          `Allowed status: ${allowedStatuses.join(", ")}`,
      );
    }

    if (this._status === BroadcastStatus.CANCELLED) {
      throw new DomainError("Cannot process cancelled broadcast");
    }

    if (!this._videoId) {
      throw new DomainError("Cannot start processing without video ID");
    }

    this._status = BroadcastStatus.PROCESSING;
    this._updatedAt = new Date();
  }

  setVideoId(videoId: string): void {
    if (this._videoId !== null) {
      throw new DomainError("Video ID is already set");
    }

    const allowedStatuses = [
      BroadcastStatus.AWAITING_VIDEO,
      BroadcastStatus.AWAITING_PROCESSING,
    ];

    if (!allowedStatuses.includes(this._status)) {
      throw new DomainError(
        `Cannot set video ID when broadcast is in status: ${this._status}. ` +
          `Allowed statuses: ${allowedStatuses.join(", ")}`,
      );
    }

    if (this._status === BroadcastStatus.CANCELLED) {
      throw new DomainError("Cannot set video ID for cancelled broadcast");
    }

    this._videoId = videoId;
    this._status = BroadcastStatus.AWAITING_PROCESSING;
    this._updatedAt = new Date();
  }

  cancel(): void {
    const allowedStatuses = [
      BroadcastStatus.AWAITING_VIDEO,
      BroadcastStatus.AWAITING_PROCESSING,
      BroadcastStatus.PROCESSING,
      BroadcastStatus.SCHEDULED,
    ];

    if (!allowedStatuses.includes(this._status)) {
      throw new DomainError(
        `Cannot cancel broadcast from status: ${this._status}. ` +
          `Allowed statuses: ${allowedStatuses.join(", ")}`,
      );
    }

    if (this._status === BroadcastStatus.COMPLETED) {
      throw new DomainError("Cannot cancel already completed broadcast");
    }

    this._status = BroadcastStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  complete(): void {
    if (this._status !== BroadcastStatus.LIVE) {
      throw new DomainError(
        `Cannot complete broadcast from status: ${this._status}. ` +
          `Only LIVE broadcasts can be completed`,
      );
    }

    this._status = BroadcastStatus.COMPLETED;
    this._updatedAt = new Date();
  }
}
