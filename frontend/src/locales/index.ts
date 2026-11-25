import { en } from "./en";
import { am } from "./am";
import { om } from "./om";

export type Language = "en" | "am" | "om";

export const dictionaries = {
  en,
  am,
  om,
};

// 3-way language choose options between English, Amharic, and Afaan Oromoo - strictly NO flags
export const languageOptions: Array<{ code: Language; label: string; nativeName: string }> = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "am", label: "Amharic", nativeName: "አማርኛ" },
  { code: "om", label: "Afaan Oromoo", nativeName: "Afaan Oromoo" },
];

export { en, am, om };
export type { TranslationDictionary } from "./en";
