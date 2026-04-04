import { Middleware } from "grammy";
import { UserAlreadyExistsError, UserRegistrator } from "../../../domain/services/user-registrator";
import { BotContext } from "../bot";

export function authMiddleware(userRegistrator: UserRegistrator): Middleware<BotContext> {
  return async (ctx, next) => {
    if (ctx.session.user) return await next();
    if (!ctx.from) return await ctx.reply("Не удалось определить пользователя");

    try {
      const user = await userRegistrator.register(
        ctx.from.id.toString(),
        ctx.from.username || ctx.from.first_name,
      );

      ctx.session.user = user;
      await next();
    } catch (err: unknown) {
      if (err instanceof UserAlreadyExistsError) {
        const existingUser = await userRegistrator.login(ctx.from.id.toString());
        ctx.session.user = existingUser;
        return await next();
      }

      console.error(err);
      await ctx.reply("Произошла ошибка при авторизации. Попробуйте позже.");
    }
  }
}