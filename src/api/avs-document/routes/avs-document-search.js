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
    {
      method: "GET",
      path: "/avs-documents/accessible",
      handler: "avs-document.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
