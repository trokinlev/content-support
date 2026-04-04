import { Bot, Context, session, SessionFlavor } from "grammy";
import {
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { StartHandler } from "./handlers/start.handler";
import { Db } from "mongodb";
import { createBroadcastConv } from "./conversations/create-broadcast.conv";
import { ScheduleHandler } from "./handlers/schedule.handler";
import { BroadcastHandler } from "./handlers/broadcast.handler";
import { MongodbVideoRepository } from "../../video";
import { MongodbBroadcastRepository, Notifier } from "../../broadcast/broadcast";
import { User } from "../../domain/entities/user.entitiy";
import { UserRegistrator } from "../../domain/services/user-registrator";
import { authMiddleware } from "./middlewares/auth.middleware";


export class TelegramNotifier implements Notifier {
  constructor(private readonly _bot: Bot<BotContext>) {}

  async sendMessage(chatId: number, message: string): Promise<void> {
    await this._bot.api.sendMessage(chatId, message);
  }
} 


export interface SessionData {
  user?: User;
}

type BaseContext = Context & SessionFlavor<SessionData>;
export type BotContext = ConversationFlavor<BaseContext>;
export type BotConversation = Conversation<BotContext, BotContext>;

export interface BotHandler {
  handle(ctx: BotContext): Promise<void>;
}

export class TelegramBot {
  private _bot: Bot<BotContext>;

  constructor(
    private readonly db: Db,
    private readonly cache: Map<string, any>,
    private readonly userRegistrator: UserRegistrator,
  ) {
    if (!process.env.BOT_TOKEN) {
      throw new Error("The BOT_TOKEN environment variable is missing");
    }

    this._bot = new Bot<BotContext>(process.env.BOT_TOKEN);

    this._bot.use(session<SessionData, BotContext>({ initial: () => ({}) }));

    const broadcastRepo = new MongodbBroadcastRepository(this.db);
    const videoRepo = new MongodbVideoRepository(this.db);
    const scheduleHandler = new ScheduleHandler(broadcastRepo);
    const broadcastHandler = new BroadcastHandler(broadcastRepo, videoRepo);
    const startHandler = new StartHandler(
      this.cache,
      broadcastRepo,
      scheduleHandler,
      broadcastHandler,
    );

    this._bot.use(conversations());
    this._bot.use(
      createConversation(createBroadcastConv(this.cache), "create-broadcast"),
    );
    this._bot.use(authMiddleware(userRegistrator));

    this._bot.command("start", startHandler.handle.bind(startHandler));
  }

  async start(): Promise<void> {
    this._bot.start();
  }

  createNotifier(): Notifier {
    return new TelegramNotifier(this._bot);
  }
}
