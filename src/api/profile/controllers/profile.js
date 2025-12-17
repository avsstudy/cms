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

const USERS_PHOTO_FOLDER_ID = process.env.USERS_PHOTO_FOLDER_ID
  ? Number(process.env.USERS_PHOTO_FOLDER_ID)
  : null;

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

function normalizeBody(body) {
  const out = { ...body };

  if (out.gender === "null" || out.gender === "") out.gender = null;
  if (out.birthday === "null" || out.birthday === "") out.birthday = null;
  if (out.lastName === "null" || out.lastName === "") out.lastName = null;
  if (out.phone === "null" || out.phone === "") out.phone = null;

  return out;
}

module.exports = {
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      {
        fields: READ_FIELDS,
        populate: {
          photo: true,
        },
      }
    );

    ctx.body = { user };
  },

  async updateMe(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const rawBody = normalizeBody(ctx.request.body || {});
    const data = pick(rawBody, UPDATE_FIELDS);

    if (data.gender && !["male", "female"].includes(data.gender)) {
      return ctx.badRequest("Invalid gender");
    }

    const before = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      {
        fields: [...ZOHO_FIELDS, "zoho_id"],
        populate: { photo: true },
      }
    );

    let uploadedPhoto = null;
    const files = ctx.request.files || {};
    const photoFile = files.photo;

    if (photoFile) {
      const uploadService = strapi.plugin("upload").service("upload");

      const uploaded = await uploadService.upload({
        data: {
          fileInfo: {
            folder: USERS_PHOTO_FOLDER_ID || undefined,
            name: `user-${userId}-photo`,
          },
        },
        files: photoFile,
      });

      uploadedPhoto = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    }

    const updateData = {
      ...data,
      ...(uploadedPhoto?.id ? { photo: uploadedPhoto.id } : {}),
    };

    const updated = await strapi.entityService.update(
      "plugin::users-permissions.user",
      userId,
      {
        data: updateData,
        fields: READ_FIELDS,
        populate: { photo: true },
      }
    );

    try {
      if (
        uploadedPhoto?.id &&
        before?.photo?.id &&
        before.photo.id !== uploadedPhoto.id
      ) {
        await strapi.plugin("upload").service("upload").remove(before.photo);
      }
    } catch (e) {
      strapi.log.warn(
        "[profile.updateMe] failed to remove old photo: " + (e?.message || e)
      );
    }

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

          await axios.post(
            "https://core.avstudy.com.ua/api/lead/new",
            zohoPayload,
            {
              httpsAgent: insecureAgent,
            }
          );
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
