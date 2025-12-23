"use strict";

module.exports = {
  /**
   * GET /api/payments/me
   */
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized("Not authenticated");

    const page = Math.max(parseInt(ctx.query.page || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(ctx.query.pageSize || "10", 10), 1),
      50
    );

    const filters = { user: userId };

    const [items, total] = await Promise.all([
      strapi.entityService.findMany("api::payment.payment", {
        filters,
        sort: { createdAt: "desc" },
        fields: [
          "orderReference",
          "payment_status",
          "amount",
          "currency",
          "paidAt",
          "createdAt",
          "failReason",
        ],
        populate: {
          package: { fields: ["id", "title"] },
        },
        start: (page - 1) * pageSize,
        limit: pageSize,
      }),

      strapi.db.query("api::payment.payment").count({ where: filters }),
    ]);

    ctx.body = {
      data: (items ?? []).map((p) => ({
        id: p.id,
        orderReference: p.orderReference,
        status: p.payment_status,
        amount: p.amount,
        currency: p.currency,
        paidAt: p.paidAt ?? null,
        createdAt: p.createdAt,
        failReason: p.failReason ?? null,
        package: p.package
          ? { id: p.package.id, title: p.package.title }
          : null,
      })),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  },
};
