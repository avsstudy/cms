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
    strapi.log.info("[WFP] webhook HIT");
    strapi.log.info("[WFP] headers=" + JSON.stringify(ctx.request.headers));

    const body = ctx.request.body;

    // 1) Просто показуємо тип body
    strapi.log.info("[WFP] bodyType=" + typeof body);

    // 2) Просто витягуємо ключі body
    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    strapi.log.info("[WFP] bodyKeys=" + JSON.stringify(keys));

    // 3) Беремо перший ключ (саме там у тебе лежить "payload")
    const firstKey = keys[0] || "";
    strapi.log.info("[WFP] firstKeyLen=" + String(firstKey.length));
    strapi.log.info("[WFP] firstKeyFirst200=" + firstKey.slice(0, 200));

    // 4) Якщо треба — пробуємо дістати значення під цим ключем (у тебе воно "" або об'єкт)
    // Це НЕ парсинг, просто доступ по ключу
    const firstValue = firstKey ? body[firstKey] : undefined;
    try {
      strapi.log.info("[WFP] firstValueType=" + typeof firstValue);
      strapi.log.info("[WFP] firstValue=" + JSON.stringify(firstValue));
    } catch (e) {
      strapi.log.warn("[WFP] firstValue stringify failed: " + e.message);
    }

    // 5) І одразу видно, чому 400: реальних полів тут немає
    strapi.log.info(
      "[WFP] directFields=" +
        JSON.stringify({
          merchantAccount: body?.merchantAccount,
          orderReference: body?.orderReference,
          transactionStatus: body?.transactionStatus,
          merchantSignature: body?.merchantSignature,
        })
    );

    return (ctx.body = { ok: true });
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
