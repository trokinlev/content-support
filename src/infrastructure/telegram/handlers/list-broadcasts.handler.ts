import { BroadcastRepository } from "../../../domain/repositories/broadcast.repository";
import { ChannelRepository } from "../../../domain/repositories/channel.repository";
import { BotContext } from "../bot";
import { formatDate } from "../fmt";

export class ListBroadcastsHandler {
  constructor(private readonly broadcastRepo: BroadcastRepository, private readonly channelRepo: ChannelRepository) {}

  async handle(ctx: BotContext): Promise<void> {
    const broadcasts = await this.broadcastRepo.findAll();
    const channels = await this.channelRepo.findAll();

    let message = `<b>Расписание:</b>`;

    if (broadcasts.length) {
      for (const event of broadcasts) {
        const channel = channels.find((el) => el.id === event.channelId);
        message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=${event.id}_broadcast">${formatDate(event.scheduledStartTime)}`;
        message += `| ${channel?.title || "⚠️ Канал не определен"}</a>`;
      }
    } else {
      message += "\n\nНет запланированных событий";
    }

    message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=_scheduled-broadcast">➕Запланировать</a>`;
    message += `\n\n<b>Каналы:</b>`;

    if (channels.length) {
      for (const channel of channels) {
        message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=_create-broadcast">${channel.title}</a>`;
      }
    } else {
      message += "\n\nНет каналов";
    }

    message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=_create-new-channel">➕Добавить</a>`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });
  }
}
