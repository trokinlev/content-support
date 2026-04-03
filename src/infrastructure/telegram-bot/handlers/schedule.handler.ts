import { BroadcastRepository } from "../../../broadcast";
import { BotContext, BotHandler } from "../bot";
import { formatDate } from "../fmt";

export class ScheduleHandler implements BotHandler {
  constructor(private readonly broadcastRepo: BroadcastRepository) {}

  async handle(ctx: BotContext): Promise<void> {
    const broadcasts = await this.broadcastRepo.getAll();

    let message = `Нет запланированных событий`;

    if (broadcasts.length) {
      message = "";

      for (const event of broadcasts) {
        message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=${event.id}_broadcast">${formatDate(event.scheduledFor)} | ${event.title}</a>`;
      }
    }

    message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=_create-broadcast">➕Добавить</a>`;

    await ctx.reply(`<b>Расписание:</b>` + message, {
      parse_mode: "HTML",
    });
  }
}
