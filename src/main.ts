import "dotenv/config";
import { listen } from "./infrastructure/http/server";
import { TelegramBot } from "./infrastructure/telegram/bot";
import { UploadController } from "./infrastructure/http/controllers/upload.controller";
import { MongodbBroadcastRepository } from "./broadcast/broadcast";
import { FFmpegVideoProcessor, MongodbVideoRepository } from "./video";
import { BroadcastOrganizer } from "./broadcast/broadcast-organizer";
import database from "./infrastructure/database/mongodb/database";
import { MongodbUserRepository } from "./infrastructure/database/mongodb/user.repository";
import { UserRegistrator } from "./domain/services/user-registrator";

async function bootstrap() {
  const db = await database.connect();
  const cache: Map<string, any> = new Map();


  const userRepo = new MongodbUserRepository(db);
  const userRegistrator = new UserRegistrator(userRepo);
  const broadcastRepo = new MongodbBroadcastRepository(db);
  const videoRepo = new MongodbVideoRepository(db);
  const organizer = new BroadcastOrganizer(broadcastRepo, videoRepo);
  const bot = new TelegramBot(db, cache, userRegistrator);
  const notif = bot.createNotifier();
  const videoProcessor = new FFmpegVideoProcessor();
  const uploadController = new UploadController(
    videoProcessor,
    videoRepo,
    notif,
    organizer,
    cache,
  );

  await organizer.restoreScheduledBroadcasts();

  listen(uploadController, cache);
  bot.start();
}

bootstrap();
