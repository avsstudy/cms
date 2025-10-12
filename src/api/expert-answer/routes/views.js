module.exports = {
  routes: [
    {
      method: "POST",
      path: "/expert-answers/:id/views",
      handler: "expert-answer.views",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
