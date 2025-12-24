module.exports = {
  routes: [
    {
      method: "GET",
      path: "/articles/accessible",
      handler: "article.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
