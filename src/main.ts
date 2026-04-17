import "dotenv/config";
import database from "./infrastructure/database/mongodb/database";
import { MongodbUserRepository } from "./infrastructure/database/mongodb/user.repository";
import { UserRegistrator } from "./domain/services/user-registrator";
import { TelegramBot } from "./infrastructure/telegram/bot";
import { StartHandler } from "./infrastructure/telegram/handlers/start.handler";
import { ListBroadcastsHandler } from "./infrastructure/telegram/handlers/list-broadcasts.handler";
import { MongodbBroadcastRepository } from "./infrastructure/database/mongodb/broadcast.repository";
import { MongodbChannelRepository } from "./infrastructure/database/mongodb/channel.repository";
import { ChannelRegistrator } from "./domain/services/channel-registrator";
import { listen } from "./infrastructure/http/server";
import { UploadController } from "./infrastructure/http/controllers/upload.controller";
import { MongodbVideoRepository } from "./infrastructure/database/mongodb/video.repository";
import { FFmpegVideoProcessor } from "./infrastructure/ffmpeg/ffmpeg-video-processor";
import { BroadcastOrganizer } from "./domain/services/broadcast-organizer";
import { FFmpegBrodcaster } from "./infrastructure/ffmpeg/ffmpeg-brodcaster";

async function bootstrap() {
  const db = await database.connect();
  const scheduledBroadcastsCache: Map<string, any> = new Map();
  const userRepo = new MongodbUserRepository(db);
  const broadcastRepo = new MongodbBroadcastRepository(db)
  const userRegistrator = new UserRegistrator(userRepo);
  const channelRepo = new MongodbChannelRepository(db);
  const channelRegistrator = new ChannelRegistrator(channelRepo);
  const listBroadcastsHandler = new ListBroadcastsHandler(broadcastRepo, channelRepo);
  const startHandler = new StartHandler(listBroadcastsHandler);
  const videoRepo = new MongodbVideoRepository(db);
  const videoProcessor = new FFmpegVideoProcessor();
  const broadcaster = new FFmpegBrodcaster();
  const organizer = new BroadcastOrganizer(broadcaster, broadcastRepo, channelRepo, videoRepo);

  organizer.restoreScheduledBroadcasts().catch((err) => {
    console.error("Error restoring scheduled broadcasts:", err);
  });

  const bot = new TelegramBot(scheduledBroadcastsCache, channelRepo, broadcastRepo, userRegistrator, channelRegistrator, startHandler);
  bot.start();
  listen(new UploadController(scheduledBroadcastsCache, videoRepo, broadcastRepo, videoProcessor, organizer), scheduledBroadcastsCache);
}

bootstrap();
