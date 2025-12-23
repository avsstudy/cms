"use strict";

module.exports = {
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized("Not authenticated");
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      {
        fields: ["id", "username", "email", "packageActiveUntil"],
        populate: {
          role: {
            fields: ["type"],
          },
          package: {
            fields: ["id", "title"],
          },
        },
      }
    );

    if (!user) {
      return ctx.notFound("User not found");
    }

    ctx.body = user;
  },
};
