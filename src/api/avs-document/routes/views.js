"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/avs-documents/:id/views",
      handler: "avs-document.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
