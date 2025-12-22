"use strict";

const crypto = require("crypto");

function hmacMd5(str, secret) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function makeOrderReference({ userId, packageId }) {
  return `pkg_${packageId}_u${userId}_${Date.now()}`;
}

/**
 * Нормалізація payload для кейса, коли WayForPay прислав JSON,
 * але content-type був application/x-www-form-urlencoded і Strapi/koa
 * розпарсив це як "ключ=порожньо", де ключ — це весь JSON-рядок.
 */
function normalizeWfpPayload(rawBody) {
  let payload = rawBody;

  // 1) Якщо body прийшло строкою
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
      return payload;
    } catch (e) {
      // залишаємо як є
    }
  }

  // 2) Якщо body — об’єкт з одним ключем, а ключ виглядає як JSON
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Object.keys(payload).length === 1
  ) {
    const onlyKey = Object.keys(payload)[0];
    if (
      onlyKey &&
      onlyKey.trim().startsWith("{") &&
      onlyKey.trim().endsWith("}")
    ) {
      try {
        payload = JSON.parse(onlyKey);
        return payload;
      } catch (e) {
        // залишаємо як є
      }
    }
  }

  return payload;
}

module.exports = {
  async checkout(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized("Unauthorized");
    }

    const { packageId } = ctx.request.body || {};
    if (!packageId) {
      return ctx.badRequest("packageId is required");
    }

    const pkg = await strapi.entityService.findOne(
      "api::package.package",
      packageId,
      { fields: ["title", "price_UAH"] }
    );

    if (!pkg) return ctx.notFound("Package not found");

    const amount = Number(pkg.price_UAH);
    if (!Number.isFinite(amount) || amount <= 0) {
      return ctx.badRequest("Invalid package price_UAH");
    }

    const currency = "UAH";
    const orderDate = unixNow();
    const orderReference = makeOrderReference({ userId: user.id, packageId });

    const payment = await strapi.entityService.create("api::payment.payment", {
      data: {
        orderReference,
        provider: "wayforpay",
        amount,
        currency,
        payment_status: "CREATED",
        user: user.id,
        package: packageId,
        wayforpayPayload: {
          stage: "checkout_created",
          packageTitle: pkg.title,
        },
      },
    });

    const merchantAccount = process.env.WFP_MERCHANT_ACCOUNT;
    const merchantDomainName = process.env.WFP_MERCHANT_DOMAIN;
    const secretKey = process.env.WFP_SECRET_KEY;

    if (!merchantAccount || !merchantDomainName || !secretKey) {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "EXPIRED",
          failReason: "WayForPay ENV not configured",
        },
      });

      return ctx.internalServerError("WayForPay ENV not configured");
    }

    const productName = [pkg.title];
    const productCount = [1];
    const productPrice = [amount];

    const baseParts = [
      merchantAccount,
      merchantDomainName,
      orderReference,
      String(orderDate),
      String(amount),
      currency,
      ...productName,
      ...productCount.map(String),
      ...productPrice.map(String),
    ];

    const baseString = baseParts.join(";");
    const merchantSignature = hmacMd5(baseString, secretKey);

    const returnUrl = `${process.env.FRONTEND_URL}/payment/wayforpay/return?order=${encodeURIComponent(
      orderReference
    )}`;
    const serviceUrl = `${process.env.BACKEND_URL}/api/payments/wayforpay/webhook`;

    await strapi.entityService.update("api::payment.payment", payment.id, {
      data: {
        wayforpayPayload: {
          stage: "checkout_ready",
          orderDate,
          returnUrl,
          serviceUrl,
        },
      },
    });

    ctx.body = {
      paymentId: payment.id,
      orderReference,
      actionUrl: "https://secure.wayforpay.com/pay",
      fields: {
        merchantAccount,
        merchantDomainName,
        merchantAuthType: "SimpleSignature",
        merchantSignature,
        orderReference,
        orderDate: String(orderDate),
        amount: String(amount),
        currency,

        "productName[]": productName,
        "productCount[]": productCount.map(String),
        "productPrice[]": productPrice.map(String),

        returnUrl,
        serviceUrl,
        language: "UA",
      },
    };
  },

  async webhook(ctx) {
    // --- LOGS: headers + body structure ---
    strapi.log.info("[WFP] webhook HIT");
    strapi.log.info("[WFP] headers=" + JSON.stringify(ctx.request.headers));

    const body = ctx.request.body;

    strapi.log.info("[WFP] bodyType=" + typeof body);

    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    strapi.log.info("[WFP] bodyKeys=" + JSON.stringify(keys));

    const firstKey = keys[0] || "";
    strapi.log.info("[WFP] firstKeyLen=" + String(firstKey.length));
    strapi.log.info("[WFP] firstKeyFirst200=" + firstKey.slice(0, 200));

    const firstValue = firstKey ? body[firstKey] : undefined;
    try {
      strapi.log.info("[WFP] firstValueType=" + typeof firstValue);
      strapi.log.info("[WFP] firstValue=" + JSON.stringify(firstValue));
    } catch (e) {
      strapi.log.warn("[WFP] firstValue stringify failed: " + e.message);
    }

    // direct fields (у тебе вони порожні, бо payload “приїхав” як ключ)
    try {
      strapi.log.info(
        "[WFP] directFields=" +
          JSON.stringify({
            merchantAccount: body?.merchantAccount,
            orderReference: body?.orderReference,
            transactionStatus: body?.transactionStatus,
            merchantSignature: body?.merchantSignature,
            amount: body?.amount,
            currency: body?.currency,
            authCode: body?.authCode,
            cardPan: body?.cardPan,
            reasonCode: body?.reasonCode,
          })
      );
    } catch (e) {
      strapi.log.warn("[WFP] directFields stringify failed: " + e.message);
    }

    // --- RAW BODY (без сторонніх бібліотек) ---
    // Працює ТІЛЬКИ якщо у config/middlewares.js для strapi::body увімкнено includeUnparsed: true
    const sym = Symbol.for("unparsedBody");
    const raw = body?.[sym];

    strapi.log.info("[WFP] hasUnparsed=" + String(!!raw));
    strapi.log.info("[WFP] unparsedIsBuffer=" + String(Buffer.isBuffer(raw)));
    strapi.log.info("[WFP] unparsedLen=" + String(raw?.length || 0));

    let payload = null;

    if (Buffer.isBuffer(raw)) {
      const rawText = raw.toString("utf8");
      strapi.log.info("[WFP] unparsedFirst200=" + rawText.slice(0, 200));
      strapi.log.info(
        "[WFP] unparsedLast200=" +
          rawText.slice(Math.max(0, rawText.length - 200))
      );

      // стандартний JSON.parse (це не "власний парсер")
      try {
        payload = JSON.parse(rawText);
        strapi.log.info("[WFP] payloadParsed=ok");
      } catch (e) {
        strapi.log.error("[WFP] payloadParsed=failed " + e.message);
      }
    }

    // якщо raw недоступний — payload з body не збереш (у твоєму форматі він зламаний)
    if (!payload) {
      strapi.log.warn("[WFP] No valid payload. Cannot update payment.");
      // Можеш повернути 200, щоб WFP не робив ретраї,
      // але платіж/пакет не оновляться без валідного payload.
      ctx.body = { ok: true };
      return;
    }

    // --- BUSINESS LOGIC (як у тебе) ---
    const merchantAccount = payload.merchantAccount;
    const orderReference = payload.orderReference;
    const amount = String(payload.amount ?? "");
    const currency = payload.currency;

    const authCode = payload.authCode ?? "";
    const cardPan = payload.cardPan ?? "";
    const transactionStatus = payload.transactionStatus;
    const reasonCode = payload.reasonCode ?? "";

    const receivedSignature = payload.merchantSignature;

    if (!orderReference || !receivedSignature || !transactionStatus) {
      strapi.log.warn(
        "[WFP] Missing required fields after raw parse: " +
          JSON.stringify({
            orderReference: !!orderReference,
            receivedSignature: !!receivedSignature,
            transactionStatus: !!transactionStatus,
          })
      );
      return ctx.badRequest("Missing required fields");
    }

    const secretKey = process.env.WFP_SECRET_KEY;
    if (!secretKey) return ctx.internalServerError("WFP_SECRET_KEY not set");

    const baseString = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      String(reasonCode),
    ].join(";");

    const expectedSignature = crypto
      .createHmac("md5", secretKey)
      .update(baseString, "utf8")
      .digest("hex");

    strapi.log.info("[WFP] receivedSignature=" + receivedSignature);
    strapi.log.info("[WFP] baseString=" + baseString);
    strapi.log.info("[WFP] expectedSignature=" + expectedSignature);

    if (expectedSignature !== receivedSignature) {
      return ctx.forbidden("Invalid signature");
    }

    const payments = await strapi.entityService.findMany(
      "api::payment.payment",
      {
        filters: { orderReference },
        populate: { user: true, package: true },
        limit: 1,
      }
    );

    const payment = payments?.[0];
    if (!payment) return ctx.notFound("Payment not found");

    if (transactionStatus === "Approved") {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "APPROVED",
          paidAt: new Date(),
          wayforpayPayload: payload,
        },
      });

      const userId = payment?.user?.id;
      const packageId = payment?.package?.id;

      if (userId && packageId) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: { package: packageId },
          }
        );
      }
    } else if (transactionStatus === "Declined") {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "DECLINED",
          wayforpayPayload: payload,
          failReason: payload.reason ?? "Declined",
        },
      });
    } else {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: { wayforpayPayload: payload },
      });
    }

    // --- Response to WayForPay: accept ---
    const time = Math.floor(Date.now() / 1000);
    const status = "accept";
    const responseSignature = crypto
      .createHmac("md5", secretKey)
      .update([orderReference, status, String(time)].join(";"), "utf8")
      .digest("hex");

    ctx.body = { orderReference, status, time, signature: responseSignature };
  },
  async status(ctx) {
    const user = ctx.state.user;
    const orderReference = ctx.query.orderReference;

    if (!user?.id) return ctx.unauthorized("Unauthorized");
    if (!orderReference) return ctx.badRequest("orderReference is required");

    const payments = await strapi.entityService.findMany(
      "api::payment.payment",
      {
        filters: { orderReference, user: user.id },
        fields: [
          "orderReference",
          "payment_status",
          "amount",
          "currency",
          "paidAt",
        ],
        limit: 1,
      }
    );

    const payment = payments?.[0];
    if (!payment) return ctx.notFound("Payment not found");

    ctx.body = payment;
  },
};
