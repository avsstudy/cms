"use strict";

module.exports = async (policyContext, config, { strapi }) => {
  const { request, state } = policyContext;
  const authHeader = request.header.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return policyContext.unauthorized("No authorization token");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await strapi
      .plugin("users-permissions")
      .service("jwt")
      .verify(token);

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      decoded.id
    );

    if (!user) {
      return policyContext.unauthorized("User not found");
    }

    // зберігаємо юзера, як робить плагін
    state.user = user;

    return true; // пропускаємо далі
  } catch (err) {
    return policyContext.unauthorized("Invalid token");
  }
};
