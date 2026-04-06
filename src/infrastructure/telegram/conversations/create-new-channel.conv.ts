import { ChannelRegistrator } from "../../../domain/services/channel-registrator";
import { BotContext, BotConversation } from "../bot";

export const createNewChannelConv = (channelRegistrator: ChannelRegistrator) => {
  return async (conv: BotConversation, ctx: BotContext) => {
    await ctx.reply(
      "Ввод с новой строки:" +
        "\n\n<b>Название (любой текст)</b>" +
        "\n<b>Ссыдка на сервер</b>" +
        "\n<b>Ключ трансляции</b>" +
        {
          parse_mode: "HTML",
        },
    );

    const dataCtx = await conv.waitFor(":text");
    const [title, rtpmUrl, broadcastKey] = dataCtx.message?.text.split("\n")!;
    
    await channelRegistrator.register(title, rtpmUrl, broadcastKey);

    await ctx.reply("🎉 Канал создан!");
  };
};