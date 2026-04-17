import { randomUUID } from "node:crypto";

export class Video {
  private constructor(
    private readonly _id: string,
    private _originalPath: string,
    private _formattedPath: string | null,
    private _duration: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(originalPath: string): Video {
    const now = new Date();
    return new Video(randomUUID(), originalPath, null, 0, now, now);
  }

  static restore(
    id: string,
    originalPath: string,
    formattedPath: string,
    duration: number,
    createdAt: Date,
    updatedAt: Date,
  ): Video {
    return new Video(
      id,
      originalPath,
      formattedPath,
      duration,
      createdAt,
      updatedAt,
    );
  }

  get id(): string {
    return this._id;
  }
  get originalPath(): string {
    return this._originalPath;
  }
  get formattedPath(): string | null {
    return this._formattedPath;
  }
  get duration(): number {
    return this._duration;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  setDuration(duration: number) {
    this._duration = duration;
    this._updatedAt = new Date();
  }

  setFormattedPath(formattedPath: string) {
    this._formattedPath = formattedPath;
    this._updatedAt = new Date();
  }
}
