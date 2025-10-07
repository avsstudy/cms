"use strict";

module.exports = (plugin) => {
  const defaultRegister = plugin.controllers.auth.register;

  // Перевизначаємо register: не передаємо phone в дефолтну валідацію,
  // а після успішного створення юзера оновлюємо його phone
  plugin.controllers.auth.register = async (ctx) => {
    const { phone, ...rest } = ctx.request.body || {};

    // 1) Забираємо phone з тіла запиту, щоб дефолтний контролер не зловив "Invalid parameters"
    ctx.request.body = rest;

    // 2) Виконуємо дефолтну реєстрацію (створює користувача, видає jwt)
    await defaultRegister(ctx);

    // 3) Якщо юзер створений — оновлюємо йому phone
    try {
      const user = ctx.response?.body?.user;
      if (user?.id && phone) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: { phone },
          }
        );
        // повертаємо phone у відповіді теж
        ctx.response.body.user.phone = phone;
      }
    } catch (e) {
      strapi.log.warn(
        "[users-permissions] Failed to set phone after register: " +
          (e?.message || e)
      );
      // не валимо реєстрацію, просто логуємо
    }
  };

  return plugin;
};
