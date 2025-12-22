module.exports = {
  routes: [
    {
      method: "GET",
      path: "/payments/status",
      handler: "wayforpay.status",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
