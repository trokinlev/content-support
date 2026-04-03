import { UUID } from "node:crypto";
import { BroadcastRepository } from "../../../broadcast";
import { BotContext, BotHandler } from "../bot";
import { formatDate } from "../fmt";
import { Video, VideoRepository } from "../../../video";

export class BroadcastHandler implements BotHandler {
  constructor(
    private readonly broadcastRepo: BroadcastRepository,
    private readonly videoRepo: VideoRepository,
  ) {}

  // <blockquote expandable>

  async handle(ctx: BotContext): Promise<void> {
    const broadcast = await this.broadcastRepo.findById(ctx.match as UUID);

    let video: Video | null = null;
    if (broadcast.videoId) {
      video = await this.videoRepo.findById(broadcast.videoId);
    }

    await ctx.reply(
      `<b>ID</b>: ${broadcast.id.split("-")[0]}` +
        `\n<b>Название</b>: <a href="https://t.me/${process.env.BOT_USERNAME}?start=${broadcast.id}_title">${broadcast.title} ✏️</a>` +
        `\n<b>Запуск</b>: <a href="https://t.me/${process.env.BOT_USERNAME}?start=${broadcast.id}_date">${formatDate(broadcast.scheduledFor)} ✏️</a>` +
        `\n\n<b>Видео</b>` +
        `\n<blockquote><a href="https://t.me/${process.env.BOT_USERNAME}?start=${broadcast.id}_video">${video?.filename || "Нет видео"}</a>` +
        `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=${broadcast.id}_video">${"❌ Удалить видео"}</a></blockquote>` +
        `${video?.isConverted ? "\n\n🟢 Видео обработано" : "\n\n🔴 Видео не обработано"}` +
        `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=${broadcast.id}_delete">❌ Удалить</a>`,
      {
        parse_mode: "HTML",
      },
    );
  }
}
