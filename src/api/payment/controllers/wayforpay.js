"use strict";

const crypto = require("crypto");

function hmacMd5(str, secret) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function nowInKyivDate() {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return new Date(s.replace(" ", "T") + ".000");
}

function makeOrderReference({ userId, packageId }) {
  return `pkg_${packageId}_u${userId}_${Date.now()}`;
}

function normalizeWfpPayload(rawBody) {
  let payload = rawBody;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
      return payload;
    } catch (e) {}
  }

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
      } catch (e) {}
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

    strapi.log.info(`[WFP] merchantAccount=${merchantAccount}`);
    strapi.log.info(`[WFP] merchantDomainName=${merchantDomainName}`);
    strapi.log.info(`[WFP] returnUrl=${returnUrl}`);
    strapi.log.info(`[WFP] serviceUrl=${serviceUrl}`);

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
    const crypto = require("crypto");

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

    const sym = Symbol.for("unparsedBody");
    const raw = body?.[sym];

    strapi.log.info("[WFP] hasUnparsed=" + String(!!raw));
    strapi.log.info(
      "[WFP] unparsedType=" + (raw === null ? "null" : typeof raw)
    );
    strapi.log.info("[WFP] unparsedIsBuffer=" + String(Buffer.isBuffer(raw)));
    strapi.log.info("[WFP] unparsedLen=" + String(raw?.length || 0));

    let rawText = "";
    if (Buffer.isBuffer(raw)) {
      rawText = raw.toString("utf8");
    } else if (typeof raw === "string") {
      rawText = raw;
    } else if (
      raw &&
      typeof raw === "object" &&
      typeof raw.toString === "function"
    ) {
      rawText = raw.toString();
    }

    strapi.log.info("[WFP] rawTextFirst200=" + rawText.slice(0, 200));
    strapi.log.info(
      "[WFP] rawTextLast200=" + rawText.slice(Math.max(0, rawText.length - 200))
    );

    let payload = null;
    try {
      payload = JSON.parse(rawText);
      strapi.log.info(
        "[WFP] payloadParsed=ok keys=" +
          JSON.stringify(Object.keys(payload || {}))
      );
    } catch (e) {
      strapi.log.error("[WFP] payloadParsed=failed " + e.message);
      ctx.body = { ok: true };
      return;
    }

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
      String(transactionStatus),
      String(reasonCode),
    ].join(";");

    const expectedSignature = crypto
      .createHmac("md5", secretKey)
      .update(baseString, "utf8")
      .digest("hex");

    strapi.log.info("[WFP] receivedSignature=" + receivedSignature);
    strapi.log.info("[WFP] baseString=" + baseString);
    strapi.log.info("[WFP] expectedSignature=" + expectedSignature);
    strapi.log.info("[WFP] transactionStatus=" + transactionStatus);

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

    const userId = payment?.user?.id;
    const packageId = payment?.package?.id;

    strapi.log.info(
      "[WFP] payment found " +
        JSON.stringify({
          paymentId: payment.id,
          currentPaymentStatus: payment.payment_status,
          userId,
          packageId,
          orderReference,
          transactionStatus,
        })
    );

    const txStatus = String(transactionStatus || "").trim();

    if (payment.payment_status === "APPROVED") {
      strapi.log.info(
        "[WFP] already APPROVED => skip user update " + orderReference
      );

      const time = Math.floor(Date.now() / 1000);
      const status = "accept";
      const responseSignature = crypto
        .createHmac("md5", secretKey)
        .update([orderReference, status, String(time)].join(";"), "utf8")
        .digest("hex");

      ctx.body = { orderReference, status, time, signature: responseSignature };
      return;
    }

    if (txStatus === "Approved") {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "APPROVED",
          paidAt: nowInKyivDate(),
          wayforpayPayload: payload,
        },
      });

      if (userId && packageId) {
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          { fields: ["packageActiveUntil"] }
        );

        const now = new Date();
        const currentUntil = user?.packageActiveUntil
          ? new Date(user.packageActiveUntil)
          : null;

        const base = currentUntil && currentUntil > now ? currentUntil : now;

        const newUntil = new Date(base);
        newUntil.setFullYear(newUntil.getFullYear() + 1);

        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: {
              package: packageId,
              packageActiveUntil: newUntil,
            },
          }
        );

        strapi.log.info(
          "[WFP] package assigned + extended " +
            JSON.stringify({
              userId,
              packageId,
              orderReference,
              from: base.toISOString(),
              until: newUntil.toISOString(),
            })
        );
      } else {
        strapi.log.warn(
          "[WFP] Approved but missing userId/packageId " +
            JSON.stringify({ userId, packageId, paymentId: payment.id })
        );
      }
    } else if (txStatus === "Declined") {
      strapi.log.warn(
        "[WFP] DECLINED => package NOT assigned " +
          JSON.stringify({
            orderReference,
            transactionStatus: txStatus,
            paymentId: payment.id,
            userId,
            packageId,
            reason: payload?.reason,
            reasonCode: payload?.reasonCode,
          })
      );

      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "DECLINED",
          wayforpayPayload: payload,
          failReason: payload.reason ?? "Declined",
        },
      });
    } else {
      strapi.log.warn(
        "[WFP] status=" +
          txStatus +
          " => package NOT assigned " +
          JSON.stringify({
            orderReference,
            paymentId: payment.id,
            userId,
            packageId,
          })
      );

      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: { wayforpayPayload: payload },
      });
    }

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
