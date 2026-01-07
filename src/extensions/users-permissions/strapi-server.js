"use strict";

const axios = require("axios");
const https = require("https");

const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

module.exports = (plugin) => {
  const defaultRegister = plugin.controllers.auth.register;
  const defaultUserUpdate = plugin.controllers.user.update;

  if (strapi) {
    strapi.log.info(
      "[users-permissions override] Custom strapi-server.js loaded"
    );
  }

  plugin.contentTypes.user.lifecycles = {
    async beforeUpdate(event) {
      try {
        const id = event.params?.where?.id;
        if (!id) return;

        const prev = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          id,
          {
            fields: ["id", "packageActiveUntil"],
            populate: { package: { fields: ["id"] } },
          }
        );

        event.state = event.state || {};
        event.state.prevUser = prev;
      } catch (e) {
        strapi.log.warn(
          "[user.lifecycle.beforeUpdate] failed: " + (e?.message || e)
        );
      }
    },

    async afterUpdate(event) {
      try {
        const id = event.result?.id;
        const prev = event.state?.prevUser;
        if (!id || !prev) return;

        const current = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          id,
          {
            fields: ["id", "packageActiveUntil"],
            populate: { package: { fields: ["id"] } },
          }
        );

        const now = new Date();

        const prevUntil = prev.packageActiveUntil
          ? new Date(prev.packageActiveUntil)
          : null;
        const newUntil = current.packageActiveUntil
          ? new Date(current.packageActiveUntil)
          : null;

        const prevPkgId = prev.package?.id ?? null;
        const newPkgId = current.package?.id ?? null;

        const wasActive = !!(prevPkgId && prevUntil && prevUntil > now);
        const isActive = !!(newPkgId && newUntil && newUntil > now);

        if (!isActive) return;

        const extended =
          prevUntil && newUntil
            ? newUntil.getTime() > prevUntil.getTime() + 1000
            : false;

        const changedPackage = prevPkgId !== newPkgId && !!newPkgId;

        const becameActiveOrExtended = !wasActive || extended || changedPackage;
        if (!becameActiveOrExtended) return;

        const nService = strapi.service("api::notification.notification");

        const untilIso = newUntil.toISOString();
        const uniqueKey = `SUBSCRIPTION_ACTIVATED:${id}:${untilIso}:${newPkgId}`;

        const created = await nService.createNotification({
          userId: id,
          code: "SUBSCRIPTION_ACTIVATED",
          uniqueKey,
          meta_data: {
            source: "user.lifecycle",
            packageId: newPkgId,
            packageActiveUntil: untilIso,
          },
        });

        if (created) {
          strapi.log.info(
            `[user.lifecycle] notification SUBSCRIPTION_ACTIVATED created user=${id} until=${untilIso}`
          );
        } else {
          strapi.log.info(
            `[user.lifecycle] notification SUBSCRIPTION_ACTIVATED skipped (exists) user=${id} until=${untilIso}`
          );
        }
      } catch (e) {
        strapi.log.error(
          "[user.lifecycle.afterUpdate] failed: " + (e?.message || e)
        );
      }
    },
  };

  plugin.controllers.auth.register = async (ctx) => {
    strapi.log.info(
      "[auth.register] START, original body:",
      JSON.stringify(ctx.request.body)
    );

    const { phone, ...rest } = ctx.request.body || {};
    strapi.log.info(
      "[auth.register] Extracted phone:",
      phone,
      "rest:",
      JSON.stringify(rest)
    );

    ctx.request.body = rest;

    try {
      strapi.log.info("[auth.register] Calling defaultRegister...");
      await defaultRegister(ctx);
      strapi.log.info(
        "[auth.register] defaultRegister finished. Response body:",
        JSON.stringify(ctx.response?.body || ctx.body)
      );
    } catch (err) {
      strapi.log.error(
        "[auth.register] defaultRegister threw error:",
        err?.message || err
      );
      throw err;
    }

    try {
      const user = ctx.response?.body?.user || ctx.body?.user;
      strapi.log.info(
        "[auth.register] User after defaultRegister:",
        JSON.stringify(user)
      );

      if (user?.id && phone) {
        strapi.log.info(
          `[auth.register] Updating user ${user.id} with phone ${phone}`
        );

        const updatedUser = await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: { phone },
          }
        );

        strapi.log.info(
          "[auth.register] entityService.update (phone) result:",
          JSON.stringify(updatedUser)
        );

        if (ctx.response?.body?.user) {
          ctx.response.body.user.phone = updatedUser.phone;
        } else if (ctx.body?.user) {
          ctx.body.user.phone = updatedUser.phone;
        }

        strapi.log.info(
          "[auth.register] Phone patched into response:",
          updatedUser.phone
        );
      } else {
        strapi.log.info(
          "[auth.register] Skip phone update: user.id or phone is missing",
          "user.id=",
          user?.id,
          "phone=",
          phone
        );
      }
    } catch (e) {
      strapi.log.warn(
        "[auth.register] failed to set phone: " + (e?.message || e)
      );
    }
  };

  plugin.controllers.user.update = async (ctx) => {
    strapi.log.info(
      "[user.update] START. params:",
      JSON.stringify(ctx.params),
      "body:",
      JSON.stringify(ctx.request.body)
    );

    const { phone } = ctx.request.body || {};
    strapi.log.info("[user.update] Extracted phone from body:", phone);

    try {
      strapi.log.info("[user.update] Calling defaultUserUpdate...");
      await defaultUserUpdate(ctx);
      strapi.log.info(
        "[user.update] defaultUserUpdate finished. Response body:",
        JSON.stringify(ctx.response?.body || ctx.body)
      );
    } catch (err) {
      strapi.log.error(
        "[user.update] defaultUserUpdate threw error:",
        err?.message || err
      );
      throw err;
    }

    try {
      const updatedUser = ctx.response?.body || ctx.body;
      strapi.log.info(
        "[user.update] updatedUser from response:",
        JSON.stringify(updatedUser)
      );

      if (!updatedUser?.id) {
        strapi.log.info(
          "[user.update] No updatedUser.id, skipping Zoho logic."
        );
        return;
      }

      if (!phone) {
        strapi.log.info(
          "[user.update] No phone in request body, skipping Zoho logic."
        );
        return;
      }

      strapi.log.info(
        "[user.update] Sending POST to Zoho with user:",
        updatedUser.id,
        "phone:",
        phone
      );

      const zohoPayload = {
        class: "lead",
        function: "new",
        name: updatedUser.username,
        email: updatedUser.email,
        phone: phone,
        package: "",
        id: "4604",
        utm_medium: "test_utm_medium",
        utm_source: "test_utm_ource",
        utm_campaign: "test_ucampaign",
        utm_term: "test_utm_term",
        utm_content: "test_utm_term",
      };

      strapi.log.info(
        "[user.update] Zoho payload:",
        JSON.stringify(zohoPayload)
      );

      const zohoResponse = await axios.post(
        "https://core.avstudy.com.ua/api/lead/new",
        zohoPayload,
        {
          httpsAgent: insecureAgent,
        }
      );

      strapi.log.info(
        "[user.update] Zoho response status:",
        zohoResponse.status
      );
      strapi.log.info(
        "[user.update] Zoho response data:",
        JSON.stringify(zohoResponse.data)
      );

      const zohoId = zohoResponse.data?.crm?.contact_id;
      strapi.log.info("[user.update] Parsed zohoId:", zohoId);

      if (!zohoId) {
        strapi.log.warn(
          "[user.update] No contact_id in Zoho response, skipping zoho_id save."
        );
        return;
      }

      strapi.log.info(
        `[user.update] Updating user ${updatedUser.id} with zoho_id=${zohoId}`
      );

      const finalUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        updatedUser.id,
        {
          data: { zoho_id: zohoId },
        }
      );

      strapi.log.info(
        "[user.update] entityService.update (zoho_id) result:",
        JSON.stringify(finalUser)
      );

      if (ctx.response?.body) ctx.response.body.zoho_id = finalUser.zoho_id;
      else if (ctx.body) ctx.body.zoho_id = finalUser.zoho_id;

      strapi.log.info(
        "[user.update] Response patched with zoho_id:",
        finalUser.zoho_id
      );
    } catch (err) {
      strapi.log.warn(
        "[user.update] failed to sync Zoho: " + (err?.message || err)
      );
    }
  };

  return plugin;
};
