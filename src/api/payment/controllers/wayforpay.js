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
    const startedAt = Date.now();

    strapi.log.info("[WFP] webhook HIT");
    strapi.log.info("[WFP] headers=" + JSON.stringify(ctx.request.headers));

    // Логуємо "сирий" body як його бачить Strapi
    try {
      const raw = ctx.request.body;
      strapi.log.info("[WFP] rawBodyType=" + typeof raw);
      if (raw && typeof raw === "object") {
        strapi.log.info(
          "[WFP] rawBodyKeys=" + JSON.stringify(Object.keys(raw))
        );
      }
      strapi.log.info("[WFP] rawBody=" + JSON.stringify(raw));
    } catch (e) {
      strapi.log.warn("[WFP] failed to log raw body: " + e.message);
    }

    // Нормалізація payload
    let payload = normalizeWfpPayload(ctx.request.body);

    // Логуємо нормалізований payload
    try {
      strapi.log.info("[WFP] normalizedType=" + typeof payload);
      if (payload && typeof payload === "object") {
        strapi.log.info(
          "[WFP] normalizedKeys=" + JSON.stringify(Object.keys(payload))
        );
      }
      strapi.log.info("[WFP] normalizedPayload=" + JSON.stringify(payload));
    } catch (e) {
      strapi.log.warn("[WFP] failed to log normalized payload: " + e.message);
    }

    // Далі працюємо тільки з payload
    const merchantAccount = payload?.merchantAccount;
    const orderReference = payload?.orderReference;
    const amount = String(payload?.amount ?? "");
    const currency = payload?.currency;

    const authCode = payload?.authCode ?? "";
    const cardPan = payload?.cardPan ?? "";
    const transactionStatus = payload?.transactionStatus;
    const reasonCode = payload?.reasonCode ?? "";

    const receivedSignature = payload?.merchantSignature;

    // Якщо досі не розпарсилося — покажемо явний лог, щоб не гадати
    if (!orderReference || !receivedSignature || !transactionStatus) {
      strapi.log.warn(
        "[WFP] Missing required fields. " +
          JSON.stringify({
            orderReference: !!orderReference,
            receivedSignature: !!receivedSignature,
            transactionStatus: !!transactionStatus,
            contentType: ctx.request.headers["content-type"],
          })
      );
      return ctx.badRequest("Missing required fields");
    }

    const secretKey = process.env.WFP_SECRET_KEY;
    if (!secretKey) return ctx.internalServerError("WFP_SECRET_KEY not set");

    // Підпис, який ви перевіряєте (залишаю як у вас)
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

    const expectedSignature = hmacMd5(baseString, secretKey);

    strapi.log.info("[WFP] receivedSignature=" + receivedSignature);
    strapi.log.info("[WFP] baseString=" + baseString);
    strapi.log.info("[WFP] expectedSignature=" + expectedSignature);
    strapi.log.info("[WFP] transactionStatus=" + transactionStatus);

    if (expectedSignature !== receivedSignature) {
      strapi.log.warn(
        "[WFP] Invalid signature for orderReference=" +
          orderReference +
          " expected=" +
          expectedSignature +
          " received=" +
          receivedSignature
      );
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
    if (!payment) {
      strapi.log.warn(
        "[WFP] Payment not found for orderReference=" + orderReference
      );
      return ctx.notFound("Payment not found");
    }

    // Оновлення payment + видача пакета
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

      strapi.log.info(
        "[WFP] Approved. Will attach package to user: " +
          JSON.stringify({ userId, packageId })
      );

      if (userId && packageId) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: { package: packageId },
          }
        );
      } else {
        strapi.log.warn(
          "[WFP] Approved but missing userId/packageId on populated payment: " +
            JSON.stringify({
              paymentId: payment.id,
              hasUser: !!payment?.user,
              hasPackage: !!payment?.package,
            })
        );
      }
    } else if (transactionStatus === "Declined") {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "DECLINED",
          wayforpayPayload: payload,
          failReason: payload?.reason ?? "Declined",
        },
      });
    } else {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: { wayforpayPayload: payload },
      });
    }

    // Відповідь WayForPay: "accept" + signature
    // (це важливо, інакше WFP може вважати webhook не підтвердженим та робити ретраї)
    const time = unixNow();
    const status = "accept";
    const responseSignature = hmacMd5(
      [orderReference, status, String(time)].join(";"),
      secretKey
    );

    ctx.body = { orderReference, status, time, signature: responseSignature };

    strapi.log.info(
      "[WFP] webhook handled in " +
        (Date.now() - startedAt) +
        "ms for " +
        orderReference
    );
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
