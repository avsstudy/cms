import ru from "./src/translations/ru.json";
import uk from "./src/translations/uk.json";

export default {
  config: {
    locales: ["en", "ru", "uk"],

    translations: {
      ru,
      uk,
    },
  },
  bootstrap(app) {
    console.log("Admin UI bootstrapped with locales:", app);
  },
};
