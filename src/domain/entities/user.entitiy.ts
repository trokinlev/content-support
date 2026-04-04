import { randomUUID } from "node:crypto";

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _externalId: string,
    private _username: string,
    private _updatedAt: Date,
    private readonly _createdAt: Date,
  ) {}

  static create(externalId: string, username: string): User {
    const now = new Date();
    return new User(randomUUID(), externalId, username, now, now);
  }

  static restore(id: string, externalId: string, username: string, updatedAt: Date, createdAt: Date): User {
    return new User(id, externalId, username, updatedAt, createdAt);
  }

  get id(): string {
    return this._id;
  }
  get externalId(): string {
    return this._externalId;
  }
  get username(): string {
    return this._username;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
