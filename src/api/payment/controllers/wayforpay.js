"use strict";

const crypto = require("crypto");

async function readRawBody(ctx) {
  return await new Promise((resolve, reject) => {
    let data = "";
    ctx.req.setEncoding("utf8");
    ctx.req.on("data", (chunk) => (data += chunk));
    ctx.req.on("end", () => resolve(data));
    ctx.req.on("error", reject);
  });
}

function normalizeWfpPayload(parsedBody, rawText) {
  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    parsedBody.merchantAccount
  ) {
    return parsedBody;
  }

  const t = (rawText || "").trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    try {
      return JSON.parse(t);
    } catch {}
  }

  try {
    const params = new URLSearchParams(t);
    const maybeJson =
      params.get("data") || params.get("response") || params.get("payload");

    if (maybeJson && maybeJson.trim().startsWith("{")) {
      return JSON.parse(maybeJson);
    }

    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    if (obj.merchantAccount || obj.orderReference) return obj;
  } catch {}

  try {
    if (parsedBody && typeof parsedBody === "object") {
      const keys = Object.keys(parsedBody);
      if (
        keys.length === 1 &&
        (parsedBody[keys[0]] === "" || parsedBody[keys[0]] == null)
      ) {
        const maybe = keys[0];
        if (maybe.trim().startsWith("{") && maybe.trim().endsWith("}")) {
          return JSON.parse(maybe);
        }
      }
    }
  } catch {}

  return null;
}

function hmacMd5(str, secret) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex");
}

function unixNow() {
  return Math.floor(Date.now() / 1000);
}

function makeOrderReference({ userId, packageId }) {
  return `pkg_${packageId}_u${userId}_${Date.now()}`;
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

    const returnUrl = `${process.env.FRONTEND_URL}/payment/wayforpay/return?order=${encodeURIComponent(orderReference)}`;
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
    let rawText = "";
    try {
      rawText = await readRawBody(ctx);
    } catch {
      rawText = "";
    }

    const parsedBody = ctx.request.body || {};
    const payload = normalizeWfpPayload(parsedBody, rawText);

    strapi.log.info("[WFP] raw=" + rawText);
    strapi.log.info("[WFP] payload=" + JSON.stringify(payload));

    if (!payload) {
      ctx.status = 200;
      ctx.body = { error: "Cannot parse payload" };
      return;
    }

    const {
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode = "",
      cardPan = "",
      transactionStatus,
      reasonCode = "",
      merchantSignature: receivedSignature,
    } = payload;

    if (!orderReference || !transactionStatus || !receivedSignature) {
      ctx.status = 200;
      ctx.body = { error: "Missing required fields", orderReference };
      return;
    }

    const secretKey = process.env.WFP_SECRET_KEY;
    if (!secretKey) {
      ctx.status = 500;
      ctx.body = { error: "WFP_SECRET_KEY not set" };
      return;
    }

    const baseString = [
      merchantAccount,
      orderReference,
      String(amount ?? ""),
      currency,
      String(authCode ?? ""),
      String(cardPan ?? ""),
      String(transactionStatus ?? ""),
      String(reasonCode ?? ""),
    ].join(";");

    const expectedSignature = hmacMd5(baseString, secretKey);

    if (expectedSignature !== receivedSignature) {
      ctx.status = 200;
      ctx.body = { error: "Invalid signature" };
      return;
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
      ctx.status = 200;
      ctx.body = { error: "Payment not found" };
      return;
    }

    if (transactionStatus === "Approved") {
      await strapi.entityService.update("api::payment.payment", payment.id, {
        data: {
          payment_status: "APPROVED",
          paidAt: new Date(),
          wayforpayPayload: payload,
        },
      });

      const userId = payment.user?.id;
      const packageId = payment.package?.id;
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

    const time = nowUnix();
    const status = "accept";
    const responseSignature = hmacMd5(
      `${orderReference};${status};${time}`,
      secretKey
    );

    ctx.status = 200;
    ctx.body = {
      orderReference,
      status,
      time,
      signature: responseSignature,
    };
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
