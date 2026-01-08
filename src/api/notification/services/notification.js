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
  EXPERT_ANSWER_READY: {
    title: "Відповідь експерта готова",
    notification_text: "Ви отримали відповідь експерта на ваше запитання",
    ctaLabel: "Перейти до відповіді",
    ctaUrl: "/answers/my",
  },
  WEBINAR_UPCOMING_24H: {
    title: "Вебінар завтра",
    notification_text: "Вже завтра відбудеться вебінар «{free_webinar_title}»",
    ctaLabel: "Перейти до вебінару",
    ctaUrl: "/webinars",
  },
  WEBINAR_STARTED: {
    title: "Вебінар почався",
    notification_text: "Вебінар «{free_webinar_title}» розпочався.",
    ctaLabel: "Дивитися",
    ctaUrl: "/webinars",
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

function interpolate(str, vars) {
  if (!str) return str;
  return String(str)
    .replaceAll("{free_webinar_title}", vars.free_webinar_title ?? "")
    .replaceAll("{webinar_title}", vars.free_webinar_title ?? "");
}

module.exports = createCoreService(
  "api::notification.notification",
  ({ strapi }) => ({
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

      const vars = {
        free_webinar_title:
          override.free_webinar_title ??
          meta_data.free_webinar_title ??
          meta_data.webinarTitle ??
          "",
      };

      const titleRaw = override.title ?? tpl.title;
      const textRaw = override.notification_text ?? tpl.notification_text;

      const data = {
        user: userId,
        code,
        uniqueKey,

        title: interpolate(titleRaw, vars),
        notification_text: interpolate(textRaw, vars),

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
