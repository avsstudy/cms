"use strict";

module.exports = {
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized("Not authenticated");

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      {
        fields: ["packageActiveUntil"],
        populate: { package: { fields: ["id", "title", "price_UAH"] } },
      }
    );

    ctx.body = {
      package: user?.package
        ? {
            id: user.package.id,
            title: user.package.title,
            price_UAH: user.package.price_UAH ?? null,
          }
        : null,
      packageActiveUntil: user?.packageActiveUntil ?? null,
      hasActivePackage:
        !!user?.packageActiveUntil &&
        new Date(user.packageActiveUntil) > new Date(),
    };
  },
};
