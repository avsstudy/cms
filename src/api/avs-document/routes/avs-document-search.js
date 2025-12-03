"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/avs-documents/search",
      handler: "avs-document.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
