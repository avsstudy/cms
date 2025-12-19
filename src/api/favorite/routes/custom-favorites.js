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
      method: "GET",
      path: "/favorites/avs-document/ids",
      handler: "favorite.avsDocumentIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/favorites/expert-answer/ids",
      handler: "favorite.expertAnswerIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/favorites/handbook/ids",
      handler: "favorite.handbookIds",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/favorites/course/ids",
      handler: "favorite.courseIds",
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
