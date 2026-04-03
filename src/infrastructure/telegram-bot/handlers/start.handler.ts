import { BotContext, BotHandler } from "../bot";
import { BroadcastRepository } from "../../../broadcast/broadcast";
import { randomUUID, UUID } from "node:crypto";
import { ScheduleHandler } from "./schedule.handler";
import { BroadcastHandler } from "./broadcast.handler";

export class StartHandler implements BotHandler {
  constructor(
    private readonly cache: Map<string, any>,
    private readonly broadcastRepo: BroadcastRepository,
    private readonly scheduleHandler: ScheduleHandler,
    private readonly broadcastHandler: BroadcastHandler,
  ) {}

  async handle(ctx: BotContext): Promise<void> {
    if (typeof ctx.match !== "string" || !ctx.match) {
      return this.scheduleHandler.handle(ctx);
    }

    const [id, action] = ctx.match.split("_");
    switch (action) {
      case "broadcast":
        ctx.match = id;
        await this.broadcastHandler.handle(ctx);
        break
      case "create-broadcast":
        await ctx.conversation.enter("create-broadcast");
        break
      case "video":
        await this.videoDownload(ctx, id as UUID);
        break
    }
  }

  private async videoDownload(ctx: BotContext, id: UUID): Promise<void> {
    const broadcast = await this.broadcastRepo.findById(id);
    const tempId = randomUUID();

    this.cache.set(tempId, {
      broadcastId: broadcast.id,
      createdAt: new Date(),
    });

    await ctx.reply(
      `Загрузить видео для <b><u>${broadcast.title}</u></b>` +
        `\n\nhttps://csssl.click/${tempId}`,
      {
        parse_mode: "HTML",
      },
    );
  }

  static formatDate(date: Date): string {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    let day = "";
    let month = "";
    let hour = "";
    let minute = "";

    for (const part of parts) {
      switch (part.type) {
        case "day":
          day = part.value;
          break;
        case "month":
          month = part.value;
          break;
        case "hour":
          hour = part.value;
          break;
        case "minute":
          minute = part.value;
          break;
      }
    }
    day = parseInt(day).toString();
    return `${day} ${month} в ${hour}:${minute} МСК`;
  }
}