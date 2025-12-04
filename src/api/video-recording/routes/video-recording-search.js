"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/video-recordings/search",
      handler: "video-recording.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
