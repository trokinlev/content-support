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

async function bootstrap() {
  const db = await database.connect();

  const userRepo = new MongodbUserRepository(db);
  const broadcastRepo = new MongodbBroadcastRepository(db)
  const userRegistrator = new UserRegistrator(userRepo);
  const channelRepo = new MongodbChannelRepository(db);
  const channelRegistrator = new ChannelRegistrator(channelRepo);
  const listBroadcastsHandler = new ListBroadcastsHandler(broadcastRepo, channelRepo);
  const startHandler = new StartHandler(listBroadcastsHandler);

  const bot = new TelegramBot(userRegistrator, channelRegistrator, startHandler);
  bot.start();
}

bootstrap();
