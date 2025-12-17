"use strict";

const axios = require("axios");
const https = require("https");

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const READ_FIELDS = [
  "username",
  "email",
  "phone",
  "lastName",
  "gender",
  "birthday",
  "zoho_id",
];

const UPDATE_FIELDS = [
  "username",
  "email",
  "phone",
  "lastName",
  "gender",
  "birthday",
];

const ZOHO_FIELDS = ["username", "email", "phone", "lastName"];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] !== undefined) out[k] = obj[k];
  return out;
}

function changedAny(before, patch, keys) {
  return keys.some(
    (k) =>
      patch[k] !== undefined &&
      String(patch[k] ?? "") !== String(before?.[k] ?? "")
  );
}

module.exports = {
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      { fields: READ_FIELDS }
    );

    ctx.body = { user };
  },

  async updateMe(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const body = ctx.request.body || {};
    const data = pick(body, UPDATE_FIELDS);

    if (data.gender && !["male", "female"].includes(data.gender)) {
      return ctx.badRequest("Invalid gender");
    }

    const before = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      { fields: [...ZOHO_FIELDS, "zoho_id"] }
    );

    const updated = await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      { data, fields: READ_FIELDS }
    );

    const needZohoUpdate = changedAny(before, data, ZOHO_FIELDS);

    if (needZohoUpdate) {
      if (!updated.zoho_id) {
        strapi.log.info(
          "[profile.updateMe] Zoho update skipped: user has no zoho_id yet."
        );
      } else {
        try {
          const zohoPayload = {
            class: "lead",
            function: "update",
            contact_id: updated.zoho_id,
            name: updated.username || "",
            email: updated.email || "",
            phone: updated.phone || "",
            lastName: updated.lastName || "",
          };

          strapi.log.info(
            "[profile.updateMe] Sending UPDATE to Zoho payload:",
            JSON.stringify(zohoPayload)
          );

          const zohoResp = await axios.post(
            "https://core.avstudy.com.ua/api/lead/new",
            zohoPayload,
            { httpsAgent: insecureAgent }
          );

          strapi.log.info(
            "[profile.updateMe] Zoho update status:",
            zohoResp.status
          );
          strapi.log.info(
            "[profile.updateMe] Zoho update data:",
            JSON.stringify(zohoResp.data)
          );

          const newZohoId = zohoResp.data?.crm?.contact_id;
          if (newZohoId && newZohoId !== updated.zoho_id) {
            const finalUser = await strapi.entityService.update(
              "plugin::users-permissions.user",
              userId,
              { data: { zoho_id: newZohoId }, fields: READ_FIELDS }
            );
            ctx.body = { user: finalUser };
            return;
          }
        } catch (err) {
          strapi.log.warn(
            "[profile.updateMe] Zoho update failed: " + (err?.message || err)
          );
        }
      }
    }

    ctx.body = { user: updated };
  },
};
