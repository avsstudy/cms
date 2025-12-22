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
    const reqId = `wfp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const log = (level, msg, obj) => {
      const payload = obj ? ` | ${JSON.stringify(obj)}` : "";
      // strapi.log.* не завжди показує stack, тому дублюю console
      try {
        strapi.log[level](`[WFP][${reqId}] ${msg}${payload}`);
      } catch {}
      // eslint-disable-next-line no-console
      console[level === "error" ? "error" : "log"](
        `[WFP][${reqId}] ${msg}`,
        obj || ""
      );
    };

    const mask = (v, keep = 6) => {
      if (v == null) return v;
      const s = String(v);
      if (s.length <= keep) return "***";
      return s.slice(0, keep) + "***";
    };

    let rawText = "";
    try {
      rawText = await readRawBody(ctx);
    } catch (e) {
      log("error", "Failed to read raw body", { err: e?.message });
      rawText = "";
    }

    const parsedBody = ctx.request.body || {};
    const payload = normalizeWfpPayload(parsedBody, rawText);

    log("info", "Incoming webhook", {
      method: ctx.method,
      url: ctx.url,
      contentType: ctx.request?.headers?.["content-type"],
      rawLen: rawText?.length,
      parsedBodyType: typeof parsedBody,
      parsedBodyKeys:
        parsedBody && typeof parsedBody === "object"
          ? Object.keys(parsedBody)
          : null,
    });

    // ВАЖЛИВО: raw може містити PII, краще в логах зберігати коротко
    log("info", "Raw body (preview)", {
      rawPreview: (rawText || "").slice(0, 500),
    });

    if (!payload) {
      log("error", "Cannot parse payload", { parsedBody });
      ctx.status = 200;
      ctx.body = { error: "Cannot parse payload" };
      return;
    }

    // Лог payload без зайвого “світіння” картки/підписів
    log("info", "Payload parsed", {
      merchantAccount: payload.merchantAccount,
      orderReference: payload.orderReference,
      amount: payload.amount,
      currency: payload.currency,
      transactionStatus: payload.transactionStatus,
      reasonCode: payload.reasonCode,
      authCode: mask(payload.authCode),
      cardPan: mask(payload.cardPan),
      receivedSignature: mask(payload.merchantSignature),
    });

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

    if (
      !orderReference ||
      !transactionStatus ||
      !receivedSignature ||
      !merchantAccount
    ) {
      log("error", "Missing required fields", {
        merchantAccount,
        orderReference,
        transactionStatus,
        hasSignature: !!receivedSignature,
      });

      // Можна віддати reject, щоб WFP ретраїв/показав проблему
      const secretKey = process.env.WFP_SECRET_KEY;
      if (secretKey && orderReference) {
        const time = unixNow();
        const status = "reject";
        const signature = hmacMd5(
          `${orderReference};${status};${time}`,
          secretKey
        );
        ctx.status = 200;
        ctx.body = { orderReference, status, time, signature };
        return;
      }

      ctx.status = 200;
      ctx.body = { error: "Missing required fields", orderReference };
      return;
    }

    const secretKey = process.env.WFP_SECRET_KEY;
    if (!secretKey) {
      log("error", "WFP_SECRET_KEY not set");
      ctx.status = 500;
      ctx.body = { error: "WFP_SECRET_KEY not set" };
      return;
    }

    // ВАЖЛИВО: amount може бути "100.00" або 100 — для підпису важливий точний string
    const baseString = [
      merchantAccount,
      orderReference,
      String(amount ?? ""),
      String(currency ?? ""),
      String(authCode ?? ""),
      String(cardPan ?? ""),
      String(transactionStatus ?? ""),
      String(reasonCode ?? ""),
    ].join(";");

    const expectedSignature = hmacMd5(baseString, secretKey);

    log("info", "Signature check", {
      baseString,
      expectedSignature: mask(expectedSignature),
      receivedSignature: mask(receivedSignature),
      amountType: typeof amount,
      currencyType: typeof currency,
    });

    if (expectedSignature !== receivedSignature) {
      log("error", "Invalid signature", {
        expectedSignature,
        receivedSignature,
        baseString,
      });

      const time = unixNow();
      const status = "reject";
      const signature = hmacMd5(
        `${orderReference};${status};${time}`,
        secretKey
      );

      ctx.status = 200;
      ctx.body = { orderReference, status, time, signature };
      return;
    }

    // Шукаємо payment
    let payment;
    try {
      const payments = await strapi.entityService.findMany(
        "api::payment.payment",
        {
          filters: { orderReference },
          populate: { user: true, package: true },
          limit: 1,
        }
      );
      payment = payments?.[0];

      log("info", "Payment lookup result", {
        orderReference,
        found: !!payment,
        paymentId: payment?.id,
        currentStatus: payment?.payment_status,
        userId: payment?.user?.id,
        packageId: payment?.package?.id,
      });
    } catch (e) {
      log("error", "Payment lookup failed", {
        err: e?.message,
        orderReference,
      });
    }

    if (!payment) {
      const time = unixNow();
      const status = "reject";
      const signature = hmacMd5(
        `${orderReference};${status};${time}`,
        secretKey
      );

      ctx.status = 200;
      ctx.body = { orderReference, status, time, signature };
      return;
    }

    // Оновлення payment
    try {
      if (transactionStatus === "Approved") {
        log("info", "Applying APPROVED update", { paymentId: payment.id });

        const upd = await strapi.entityService.update(
          "api::payment.payment",
          payment.id,
          {
            data: {
              payment_status: "APPROVED",
              paidAt: new Date(),
              wayforpayPayload: payload,
            },
          }
        );

        log("info", "Payment updated APPROVED", {
          paymentId: payment.id,
          newStatus: upd?.payment_status,
          paidAt: upd?.paidAt,
        });

        const userId = payment.user?.id;
        const packageId = payment.package?.id;

        if (userId && packageId) {
          try {
            const userUpd = await strapi.entityService.update(
              "plugin::users-permissions.user",
              userId,
              { data: { package: packageId } }
            );
            log("info", "User package updated", {
              userId,
              packageId,
              ok: !!userUpd,
            });
          } catch (e) {
            log("error", "Failed to update user package", {
              userId,
              packageId,
              err: e?.message,
            });
          }
        } else {
          log("error", "Missing userId/packageId on payment populate", {
            userId,
            packageId,
            paymentId: payment.id,
          });
        }
      } else if (transactionStatus === "Declined") {
        log("info", "Applying DECLINED update", { paymentId: payment.id });

        const upd = await strapi.entityService.update(
          "api::payment.payment",
          payment.id,
          {
            data: {
              payment_status: "DECLINED",
              wayforpayPayload: payload,
              failReason: payload.reason ?? "Declined",
            },
          }
        );

        log("info", "Payment updated DECLINED", {
          paymentId: payment.id,
          newStatus: upd?.payment_status,
          failReason: upd?.failReason,
        });
      } else {
        log("info", "Non-final transactionStatus, saving payload only", {
          paymentId: payment.id,
          transactionStatus,
        });

        await strapi.entityService.update("api::payment.payment", payment.id, {
          data: { wayforpayPayload: payload },
        });
      }
    } catch (e) {
      log("error", "Payment update failed", {
        paymentId: payment.id,
        err: e?.message,
        transactionStatus,
      });

      const time = unixNow();
      const status = "reject";
      const signature = hmacMd5(
        `${orderReference};${status};${time}`,
        secretKey
      );

      ctx.status = 200;
      ctx.body = { orderReference, status, time, signature };
      return;
    }

    // Відповідь WFP
    const time = unixNow();
    const status = "accept";
    const responseSignature = hmacMd5(
      `${orderReference};${status};${time}`,
      secretKey
    );

    log("info", "Responding to WFP", {
      orderReference,
      status,
      time,
      responseSignature: mask(responseSignature),
    });

    ctx.status = 200;
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
