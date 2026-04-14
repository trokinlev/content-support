import { BotContext } from "../bot";
import { ListBroadcastsHandler } from "./list-broadcasts.handler";

export class StartHandler {
  constructor(
    private readonly scheduleHandler: ListBroadcastsHandler,
  ) {}

  handle = async (ctx: BotContext): Promise<void> => {
    if (typeof ctx.match !== "string" || !ctx.match) {
      return this.scheduleHandler.handle(ctx);
    }

    const [id, action] = ctx.match.split("_");
    switch (action) {
      case "create-new-channel":
        ctx.match = id;
        await ctx.conversation.enter("create-new-channel");
        break;
      case "scheduled-broadcast":
        ctx.match = id;
        await ctx.conversation.enter("scheduled-new-broadcast");
        break;
    }
  }
}