module.exports = {
  routes: [
    {
      method: "POST",
      path: "/payments/wayforpay/checkout",
      handler: "wayforpay.checkout",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
