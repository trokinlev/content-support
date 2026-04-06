import { randomUUID } from "node:crypto";

export class Channel {
  private constructor(
    private readonly _id: string,
    private _title: string,
    private _rtmpUrl: string,
    private _key: string,
  ) {}

  static create(title: string, rtmpUrl: string, key: string): Channel {
    return new Channel(randomUUID(), title, rtmpUrl, key);
  }

  static restore(id: string, title: string, rtmpUrl: string, key: string): Channel {
    return new Channel(id, title, rtmpUrl, key);
  }

  get id(): string {
    return this._id;
  }
  get title(): string {
    return this._title;
  }
  get rtmpUrl(): string {
    return this._rtmpUrl;
  }
  get key(): string {
    return this._key;
  }
}
