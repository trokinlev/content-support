import { randomUUID } from "node:crypto";
import { Broadcast } from "../../../broadcast/broadcast";
import { BotContext, BotConversation } from "../bot";
import { parseDateTime } from "../fmt";

export const createBroadcastConv = (
  cache: Map<string, any>,
) => {
  return async (conv: BotConversation, ctx: BotContext) => {
    await ctx.reply(
      "Ввод с новой строки:" +
        "\n\n<b>Название (любой текст)</b>" +
        "\n<b>Ссыдка на сервер</b>" +
        "\n<b>Ключ трансляции</b>" +
        "\n<b>Дата и время запуска (ДД.ММ ЧЧ:ММ)</b>",
      {
        parse_mode: "HTML",
      },
    );

    const dataCtx = await conv.waitFor(":text");
    const [title, rtpmUrl, broadcastKey, dateString] = dataCtx.message?.text.split("\n")!;
    
    let date: Date | null = null;
    try {
      date = parseDateTime(dateString);
    } catch (err) {
      console.error(err);
      console.log(title, rtpmUrl, broadcastKey, dateString);
      return ctx.reply("Не удалось обработать дату и время");
    }

    if (!date) {
      console.log(title, rtpmUrl, broadcastKey, dateString);
      return ctx.reply("Не удалось обработать дату и время");
    }

    const broadcast = Broadcast.create({
      title: title.trim(),
      rtpmUrl: rtpmUrl.trim(),
      key: broadcastKey.trim(),
      scheduledFor: date,
    });

    const tempId = randomUUID();
  
    cache.set(tempId, {
      chatId: ctx.from?.id,
      broadcast,
    });

    await ctx.reply(
      `<a href="https://${process.env.DOMAIN}/${tempId}">Загрузить видео</a>`,
      {
        parse_mode: "HTML",
      },
    );
  };
};
