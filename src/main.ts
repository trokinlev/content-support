import "dotenv/config";
import database from "./database";
import { listen } from "./infrastructure/http/server";
import { TelegramBot } from "./infrastructure/telegram-bot/bot";
import { UploadController } from "./infrastructure/http/controllers/upload.controller";
import { MongodbBroadcastRepository } from "./broadcast/broadcast";
import { FFmpegVideoProcessor, MongodbVideoRepository } from "./video";
import { BroadcastOrganizer } from "./broadcast/broadcast-organizer";

async function bootstrap() {
  const db = await database.connect();
  const cache: Map<string, any> = new Map();
  const broadcastRepo = new MongodbBroadcastRepository(db);
  const videoRepo = new MongodbVideoRepository(db);
  const organizer = new BroadcastOrganizer(broadcastRepo, videoRepo);
  const bot = new TelegramBot(db, cache);
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
