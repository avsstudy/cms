// "use strict";

// module.exports = (plugin) => {
//   const defaultRegister = plugin.controllers.auth.register;

//   plugin.controllers.auth.register = async (ctx) => {
//     const { phone, ...rest } = ctx.request.body || {};
//     ctx.request.body = rest;

//     await defaultRegister(ctx);

//     try {
//       const user = ctx.response?.body?.user;
//       if (user?.id && phone) {
//         await strapi.entityService.update(
//           "plugin::users-permissions.user",
//           user.id,
//           {
//             data: { phone },
//           }
//         );
//         ctx.response.body.user.phone = phone;
//       }
//     } catch (e) {
//       strapi.log.warn("[register] failed to set phone: " + (e?.message || e));
//     }
//   };

//   return plugin;
// };
"use strict";

module.exports = (plugin) => {
  const defaultRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    const { phone, ...rest } = ctx.request.body || {};
    ctx.request.body = rest;

    await defaultRegister(ctx);

    try {
      const user = ctx.response?.body?.user;

      if (user?.id && phone) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: { phone },
          }
        );
        ctx.response.body.user.phone = phone;
      }

      if (user?.id && user.email && phone) {
        try {
          const payload = {
            class: "lead",
            function: "new",
            name: user.username,
            email: user.email,
            phone: phone,
            package: "",
            id: "4604",
            utm_medium: "test_utm_medium",
            utm_source: "test_utm_ource",
            utm_campaign: "test_ucampaign",
            utm_term: "test_utm_term",
            utm_content: "test_utm_term",
          };

          const res = await fetch("https://core.avstudy.com.ua/api/lead/new", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            strapi.log.warn(
              `[register] AVStudy lead failed: status=${res.status}, body=${errBody}`
            );
          } else {
            const data = await res.json().catch(() => null);

            const contactId = data?.crm?.contact_id;
            if (contactId) {
              await strapi.entityService.update(
                "plugin::users-permissions.user",
                user.id,
                {
                  data: { zoho_id: contactId },
                }
              );

              ctx.response.body.user.zoho_id = contactId;
            } else {
              strapi.log.warn(
                "[register] AVStudy lead response has no crm.contact_id"
              );
            }
          }
        } catch (e) {
          strapi.log.warn(
            "[register] AVStudy lead request failed: " + (e?.message || e)
          );
        }
      }
    } catch (e) {
      strapi.log.warn(
        "[register] post-register logic failed: " + (e?.message || e)
      );
    }
  };

  return plugin;
};
