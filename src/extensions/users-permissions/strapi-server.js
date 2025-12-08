"use strict";

module.exports = (plugin) => {
  const defaultRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    const { phone, ...rest } = ctx.request.body || {};
    ctx.request.body = rest;

    await defaultRegister(ctx);

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
        ctx.response.body.user.phone = phone;
      }
    } catch (e) {
      strapi.log.warn("[register] failed to set phone: " + (e?.message || e));
    }
  };

  return plugin;
};
