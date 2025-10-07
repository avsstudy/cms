"use strict";

module.exports = (plugin) => {
  const defaultRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    const { phone } = ctx.request.body;

    if (!phone) {
      return ctx.badRequest("phone is required");
    }

    ctx.request.body = { ...ctx.request.body, phone };

    await defaultRegister(ctx);
  };

  return plugin;
};
