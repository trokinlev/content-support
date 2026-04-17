import { Bot, Context, session, SessionFlavor } from "grammy";
import {
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { User } from "../../domain/entities/user.entitiy";
import { UserRegistrator } from "../../domain/services/user-registrator";
import { authMiddleware } from "./middlewares/auth.middleware";
import { StartHandler } from "./handlers/start.handler";
import { createNewChannelConv } from "./conversations/create-new-channel.conv";
import { ChannelRegistrator } from "../../domain/services/channel-registrator";
import { scheduledNewBroadcast } from "./conversations/scheduled-new-broadcast.handler";
import { ChannelRepository } from "../../domain/repositories/channel.repository";
import { BroadcastRepository } from "../../domain/repositories/broadcast.repository";


// export class TelegramNotifier implements Notifier {
//   constructor(private readonly _bot: Bot<BotContext>) {}

//   async sendMessage(chatId: number, message: string): Promise<void> {
//     await this._bot.api.sendMessage(chatId, message);
//   }
// } 


export interface SessionData {
  user?: User;
}

type BaseContext = Context & SessionFlavor<SessionData>;
export type BotContext = ConversationFlavor<BaseContext>;
export type BotConversation = Conversation<BotContext, BotContext>;

export class TelegramBot {
  private _bot: Bot<BotContext>;

  constructor(
    private readonly scheduledBroadcastsCache: Map<string, any>,
    private readonly channelRepo: ChannelRepository,
    private readonly broadcastRepo: BroadcastRepository,
    private readonly userRegistrator: UserRegistrator,
    private readonly channelRegistrator: ChannelRegistrator,
    private readonly startHandler: StartHandler,
  ) {
    if (!process.env.BOT_TOKEN) {
      throw new Error("The BOT_TOKEN environment variable is missing");
    }

    this._bot = new Bot<BotContext>(process.env.BOT_TOKEN);

    this._bot.use(session<SessionData, BotContext>({ initial: () => ({}) }));
    this._bot.use(conversations());
    this._bot.use(
      createConversation(
        createNewChannelConv(this.channelRegistrator),
        "create-new-channel",
      ),
      createConversation(
        scheduledNewBroadcast(this.channelRepo, this.broadcastRepo, this.scheduledBroadcastsCache),
        "scheduled-new-broadcast",
      ),
    );
    this._bot.use(authMiddleware(this.userRegistrator));

    this._bot.command("start", this.startHandler.handle);

    this._bot.catch((error) => {
      console.error("Error in Telegram bot:", error);
    });

  }

  async start(): Promise<void> {
    this._bot.start();
  }
}
