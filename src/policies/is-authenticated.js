"use strict";

/**
 * Пропускає тільки якщо є авторизований користувач у JWT
 * Використання: policies: ["global::is-authenticated"]
 */
module.exports = async (policyContext /*, config, { strapi } */) => {
  return !!policyContext.state.user;
};
