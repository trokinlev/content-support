import { Collection, Db } from "mongodb";
import { User } from "../../../domain/entities/user.entitiy";
import { UserRepository } from "../../../domain/repositories/user.repository";

export class MongodbUserRepository implements UserRepository {
  private collection: Collection;

  constructor(private readonly db: Db) {
    this.collection = this.db.collection("users");
  }

  async findByExternalId(id: string): Promise<User | null> {
    const document = await this.collection.findOne({ externalId: id });
    if (!document) return null

    return User.restore(
      document.id,
      document.externalId,
      document.username,
      document.updatedAt,
      document.createdAt,
    );
  }

  async save(user: User): Promise<void> {
    const exists = await this.collection.findOne({ id: user.id });

    if (exists) {
      await this.collection.updateOne(
        { id: user.id },
        {
          $set: {
            id: user.id,
            externalId: user.externalId,
            username: user.username,
            updatedAt: new Date(),
          },
        },
      );
    } else {
      await this.collection.insertOne({
        id: user.id,
        externalId: user.externalId,
        username: user.username,
        updatedAt: user.updatedAt,
        createdAt: user.createdAt,
      });
    }
  }
}
