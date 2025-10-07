// /src/admin/app.js
import ru from "./src/translations/ru.json";
import uk from "./src/translations/uk.json";

export default {
  config: {
    // Мови, які з’являться у виборі в профілі адміна:
    locales: ["en", "ru", "uk"],

    // Переклади ключів для цих локалей:
    translations: {
      ru,
      uk,
      // опційно: кастомізація en
      // en: { "Auth.form.welcome.title": "Welcome / Привіт" },
    },
  },
  bootstrap(app) {
    console.log("Admin UI bootstrapped with locales:", app);
  },
};
