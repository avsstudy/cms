"use strict";

/**
 * notification service
 */

const { createCoreService } = require("@strapi/strapi").factories;

const TEMPLATES = {
  SUBSCRIPTION_ACTIVATED: {
    title: "Підписка активована",
    notification_text:
      "Ваша підписка активована. Доступ до матеріалів відкрито",
    ctaLabel: "Перейти до матеріалів",
    ctaUrl: "/",
  },
  SUBSCRIPTION_EXPIRING_3D: {
    title: "Підписка скоро закінчиться",
    notification_text: "Ваша підписка закінчується через 3 дні",
    ctaLabel: "Продовжити підписку",
    ctaUrl: "/subscription",
  },
  SUBSCRIPTION_EXPIRED: {
    title: "Підписка завершилась",
    notification_text: "Термін дії Вашої підписки завершився",
    ctaLabel: "Оновити підписку",
    ctaUrl: "/subscription",
  },
};

function isUniqueViolation(err) {
  return (
    err &&
    (err.code === "23505" ||
      String(err.message || "")
        .toLowerCase()
        .includes("unique"))
  );
}

module.exports = createCoreService(
  "api::notification.notification",
  ({ strapi }) => ({
    templates() {
      return TEMPLATES;
    },

    async createNotification({
      userId,
      code,
      uniqueKey,
      meta_data = {},
      override = {},
    }) {
      if (!userId) throw new Error("userId is required");
      if (!code) throw new Error("code is required");
      if (!uniqueKey) throw new Error("uniqueKey is required");

      const tpl = TEMPLATES[code];
      if (!tpl) throw new Error(`Unknown notification code: ${code}`);

      const data = {
        user: userId,
        code,
        uniqueKey,
        title: override.title ?? tpl.title,
        notification_text: override.notification_text ?? tpl.notification_text,
        ctaLabel: override.ctaLabel ?? tpl.ctaLabel,
        ctaUrl: override.ctaUrl ?? tpl.ctaUrl,
        meta_data,
      };

      try {
        return await strapi.entityService.create(
          "api::notification.notification",
          { data }
        );
      } catch (err) {
        if (isUniqueViolation(err)) return null;
        throw err;
      }
    },
  })
);
