import { randomUUID } from "node:crypto";
import { Broadcast } from "../../../domain/entities/broadcast.entitiy";
import { ChannelRepository } from "../../../domain/repositories/channel.repository";
import { BotContext, BotConversation } from "../bot";
import { parseDateTime } from "../fmt";
import { BroadcastRepository } from "../../../domain/repositories/broadcast.repository";

export const scheduledNewBroadcast = (
  channelRepo: ChannelRepository,
  broadcastRepo: BroadcastRepository,
  scheduledBroadcastsCache: Map<string, any>,
) => {
  return async (conv: BotConversation, ctx: BotContext) => {
    const channels = await channelRepo.findAll();

    let message = `<b>Выберите канал, в котором хотите запланировать трансляцию:</b>`;

    if (channels.length) {
      for (const channel of channels) {
        message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=${channel.id}_selected_channel">${channel.title}</a>`;
      }
    } else {
      message += "\n\nНет каналов";
    }

    message += `\n\n<a href="https://t.me/${process.env.BOT_USERNAME}?start=_create-new-channel">➕Добавить</a>`;

    await ctx.reply(message, {
      parse_mode: "HTML",
    });

    const commandCtx = await conv.waitFor(":text");
    const commandText = commandCtx.msg?.text || "";

    if (commandText.startsWith("/start")) {
      const startParam = commandText.replace("/start", "").trim();

      if (startParam === "_create-new-channel") {
        return await conv.external(async (ctx) => {
          await ctx.conversation.exit("scheduled-new-broadcast");
          await ctx.conversation.enter("create-new-channel");
        });
      }

      if (startParam.endsWith("_selected_channel")) {
        const channelId = startParam.replace("_selected_channel", "");

        await ctx.reply(
          "Введите время начала в формате ДД.ММ ЧЧ:ММ (01.01 00:00)",
          {
            parse_mode: "HTML",
          },
        );

        const dateCtx = await conv.waitFor(":text");
        const dateText = dateCtx.message?.text.trim()!;
        const date = parseDateTime(dateText);

        await conv.external(async (ctxLocal) => {
          const broadcast = Broadcast.create({
            channelId,
            ownerId: ctxLocal.session.user?.id!,
            scheduledStartTime: date as Date,
          });

          await broadcastRepo.save(broadcast);

          const webUrl = randomUUID();
          scheduledBroadcastsCache.set(webUrl, {
            userId: ctxLocal.session.user?.id!,
            broadcastId: broadcast.id,
            createdAt: new Date(),
          });

          await ctxLocal.reply(`Загрузить видео для трансляции: https://${process.env.DOMAIN}/${webUrl}`);
        });
        
        return;
      }
    }

    await commandCtx.reply("Пожалуйста, используйте кнопки выбора");
  };
};