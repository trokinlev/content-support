import { MongoClient, Db } from "mongodb";

class MongoDB {
  private static instance: MongoDB;
  private client!: MongoClient;
  private db!: Db;

  private constructor() {}

  public static getInstance(): MongoDB {
    if (!MongoDB.instance) {
      MongoDB.instance = new MongoDB();
    }
    return MongoDB.instance;
  }

  async connect(
    uri: string = process.env.MONGODB_URI!,
    dbName: string = process.env.MONGODB_DB_NAME!,
  ): Promise<Db> {
    if (!this.client) {
      this.client = new MongoClient(uri);
      await this.client.connect();
      console.log("Connected to MongoDB");
      this.db = this.client.db(dbName);
    }
    return this.db;
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log("Disconnected from MongoDB");
    }
  }
}

export default MongoDB.getInstance();
