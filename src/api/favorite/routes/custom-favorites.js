"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/favorites/article/ids",
      handler: "favorite.articleIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/favorites/news-article/ids",
      handler: "favorite.newsArticleIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/favorites/video-recording/ids",
      handler: "favorite.videoRecordingIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "POST",
      path: "/favorites/toggle",
      handler: "favorite.toggle",
      config: { policies: ["global::is-authenticated"] },
    },
  ],
};
