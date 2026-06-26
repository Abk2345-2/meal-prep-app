/**
 * i18n — lightweight translation layer for PantryToPlate.
 *
 * Strategy:
 *   • UI strings are translated statically via this file (instant, offline).
 *   • Recipe instructions are translated on-demand via the backend proxy to
 *     Google Translate (optional, requires GOOGLE_TRANSLATE_API_KEY on backend).
 *   • Language preference is stored in SecureStore.
 *
 * 22 major Indian languages supported per the Constitution of India.
 */

export type LangCode =
  | 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'ur' | 'gu' | 'kn'
  | 'ml' | 'or' | 'pa' | 'as' | 'mai' | 'sat' | 'ks' | 'ne' | 'sd'
  | 'kok' | 'doi' | 'bho' | 'mni';

export interface Language {
  code: LangCode;
  name: string;        // English name
  nativeName: string;  // Name in the language itself
  script: string;      // Script name
}

export const LANGUAGES: Language[] = [
  { code: 'en',  name: 'English',    nativeName: 'English',      script: 'Latin'     },
  { code: 'hi',  name: 'Hindi',      nativeName: 'हिन्दी',         script: 'Devanagari'},
  { code: 'bn',  name: 'Bengali',    nativeName: 'বাংলা',          script: 'Bengali'   },
  { code: 'te',  name: 'Telugu',     nativeName: 'తెలుగు',         script: 'Telugu'    },
  { code: 'mr',  name: 'Marathi',    nativeName: 'मराठी',          script: 'Devanagari'},
  { code: 'ta',  name: 'Tamil',      nativeName: 'தமிழ்',          script: 'Tamil'     },
  { code: 'ur',  name: 'Urdu',       nativeName: 'اردو',           script: 'Nastaliq'  },
  { code: 'gu',  name: 'Gujarati',   nativeName: 'ગુજરાતી',        script: 'Gujarati'  },
  { code: 'kn',  name: 'Kannada',    nativeName: 'ಕನ್ನಡ',          script: 'Kannada'   },
  { code: 'ml',  name: 'Malayalam',  nativeName: 'മലയാളം',         script: 'Malayalam' },
  { code: 'or',  name: 'Odia',       nativeName: 'ଓଡ଼ିଆ',          script: 'Odia'      },
  { code: 'pa',  name: 'Punjabi',    nativeName: 'ਪੰਜਾਬੀ',         script: 'Gurmukhi'  },
  { code: 'as',  name: 'Assamese',   nativeName: 'অসমীয়া',        script: 'Bengali'   },
  { code: 'mai', name: 'Maithili',   nativeName: 'मैथिली',         script: 'Devanagari'},
  { code: 'sat', name: 'Santali',    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',        script: 'Ol Chiki'  },
  { code: 'ks',  name: 'Kashmiri',   nativeName: 'कॉशुर',          script: 'Devanagari'},
  { code: 'ne',  name: 'Nepali',     nativeName: 'नेपाली',         script: 'Devanagari'},
  { code: 'sd',  name: 'Sindhi',     nativeName: 'سنڌي',           script: 'Perso-Arab'},
  { code: 'kok', name: 'Konkani',    nativeName: 'कोंकणी',         script: 'Devanagari'},
  { code: 'doi', name: 'Dogri',      nativeName: 'डोगरी',          script: 'Devanagari'},
  { code: 'bho', name: 'Bhojpuri',   nativeName: 'भोजपुरी',        script: 'Devanagari'},
  { code: 'mni', name: 'Meitei',     nativeName: 'মেইতেই',         script: 'Bengali'   },
];

// UI string keys
export type TranslationKey =
  | 'addGroceries' | 'addGroceriesPlaceholder' | 'yourPantry' | 'suggestedForYou'
  | 'noItems' | 'signIn' | 'signOut' | 'nutrition' | 'quickLog' | 'logMeal'
  | 'calories' | 'mealName' | 'streakDays' | 'points' | 'ingredients' | 'steps'
  | 'cook' | 'pantry' | 'track' | 'you' | 'profile' | 'save' | 'loading'
  | 'filter' | 'search' | 'vegetarian' | 'vegan' | 'highProtein' | 'lowCarb'
  | 'expiresIn' | 'noExpiry' | 'addToLog' | 'translateRecipe';

type Translations = Record<TranslationKey, string>;

// English baseline — all other languages fall back to English for missing keys
const EN: Translations = {
  addGroceries: 'Add groceries',
  addGroceriesPlaceholder: 'e.g. "2 lbs chicken, dozen eggs"',
  yourPantry: 'Your Pantry',
  suggestedForYou: 'Suggested for you',
  noItems: 'Nothing yet — add groceries on the Cook tab.',
  signIn: 'Continue with Google',
  signOut: 'Sign out',
  nutrition: 'Nutrition',
  quickLog: 'Quick log a meal',
  logMeal: 'Log meal',
  calories: 'Calories',
  mealName: 'Meal name',
  streakDays: 'day streak',
  points: 'pts',
  ingredients: 'Ingredients',
  steps: 'Steps',
  cook: 'Cook',
  pantry: 'Pantry',
  track: 'Track',
  you: 'You',
  profile: 'Profile',
  save: 'Save',
  loading: 'Loading…',
  filter: 'Filter',
  search: 'Search recipes…',
  vegetarian: '🥗 Veg',
  vegan: '🌱 Vegan',
  highProtein: '💪 High Protein',
  lowCarb: '🥬 Low Carb',
  expiresIn: 'expires in',
  noExpiry: 'No expiry',
  addToLog: 'Add to log',
  translateRecipe: 'Translate recipe',
};

const HI: Partial<Translations> = {
  addGroceries: 'सामान जोड़ें',
  addGroceriesPlaceholder: 'जैसे "2 किलो मुर्गा, एक दर्जन अंडे"',
  yourPantry: 'आपका स्टोर',
  suggestedForYou: 'आपके लिए सुझाव',
  noItems: 'अभी कुछ नहीं — Cook टैब में सामान जोड़ें।',
  signIn: 'Google से जारी रखें',
  signOut: 'साइन आउट',
  nutrition: 'पोषण',
  quickLog: 'खाना जल्दी जोड़ें',
  logMeal: 'खाना दर्ज करें',
  calories: 'कैलोरी',
  mealName: 'खाने का नाम',
  streakDays: 'दिन की स्ट्रीक',
  points: 'अंक',
  ingredients: 'सामग्री',
  steps: 'विधि',
  cook: 'बनाएं',
  pantry: 'स्टोर',
  track: 'ट्रैक',
  you: 'आप',
  profile: 'प्रोफ़ाइल',
  save: 'सेव करें',
  loading: 'लोड हो रहा है…',
  filter: 'फ़िल्टर',
  search: 'रेसिपी खोजें…',
  vegetarian: '🥗 शाकाहारी',
  vegan: '🌱 वीगन',
  highProtein: '💪 हाई प्रोटीन',
  lowCarb: '🥬 कम कार्ब',
  expiresIn: 'समाप्त होगा',
  noExpiry: 'कोई एक्सपायरी नहीं',
  addToLog: 'लॉग में जोड़ें',
  translateRecipe: 'रेसिपी अनुवाद करें',
};

const BN: Partial<Translations> = {
  addGroceries: 'মুদিখানা যোগ করুন',
  yourPantry: 'আপনার প্যান্ট্রি',
  signIn: 'Google দিয়ে চালিয়ে যান',
  signOut: 'সাইন আউট',
  nutrition: 'পুষ্টি',
  calories: 'ক্যালোরি',
  ingredients: 'উপকরণ',
  steps: 'পদ্ধতি',
  cook: 'রান্না',
  pantry: 'প্যান্ট্রি',
  track: 'ট্র্যাক',
  you: 'আপনি',
  vegetarian: '🥗 নিরামিষ',
  translateRecipe: 'রেসিপি অনুবাদ করুন',
};

const TE: Partial<Translations> = {
  addGroceries: 'కిరాణా జోడించండి',
  yourPantry: 'మీ పాంట్రీ',
  signIn: 'Google తో కొనసాగించండి',
  nutrition: 'పోషకాహారం',
  calories: 'కేలరీలు',
  ingredients: 'పదార్థాలు',
  cook: 'వంట',
  pantry: 'పాంట్రీ',
  track: 'ట్రాక్',
  vegetarian: '🥗 శాకాహారి',
  translateRecipe: 'రెసిపీ అనువదించండి',
};

const TA: Partial<Translations> = {
  addGroceries: 'பொருட்கள் சேர்க்கவும்',
  yourPantry: 'உங்கள் சேமிப்பகம்',
  signIn: 'Google மூலம் தொடரவும்',
  nutrition: 'ஊட்டச்சத்து',
  calories: 'கலோரிகள்',
  ingredients: 'பொருட்கள்',
  cook: 'சமையல்',
  pantry: 'சேமிப்பு',
  track: 'கண்காணி',
  vegetarian: '🥗 சைவம்',
  translateRecipe: 'செய்முறை மொழிபெயர்க்கவும்',
};

const MR: Partial<Translations> = {
  addGroceries: 'किराणा जोडा',
  yourPantry: 'तुमचे स्वयंपाकघर',
  signIn: 'Google सह सुरू ठेवा',
  nutrition: 'पोषण',
  calories: 'कॅलरी',
  ingredients: 'साहित्य',
  cook: 'स्वयंपाक',
  pantry: 'पेंट्री',
  track: 'ट्रॅक',
  vegetarian: '🥗 शाकाहारी',
  translateRecipe: 'कृती भाषांतरित करा',
};

const GU: Partial<Translations> = {
  addGroceries: 'કરિયાણું ઉમેરો',
  yourPantry: 'તમારી પૅન્ટ્રી',
  signIn: 'Google સાથે ચાલુ રાખો',
  nutrition: 'પોષણ',
  calories: 'કૅલરી',
  ingredients: 'સામગ્રી',
  cook: 'રસોઈ',
  pantry: 'પૅન્ટ્રી',
  vegetarian: '🥗 શાકાહારી',
  translateRecipe: 'રેસિપી અનુવાદ કરો',
};

const KN: Partial<Translations> = {
  addGroceries: 'ದಿನಸಿ ಸೇರಿಸಿ',
  yourPantry: 'ನಿಮ್ಮ ಪ್ಯಾಂಟ್ರಿ',
  signIn: 'Google ನೊಂದಿಗೆ ಮುಂದುವರಿಯಿರಿ',
  nutrition: 'ಪೋಷಣೆ',
  calories: 'ಕ್ಯಾಲೋರಿಗಳು',
  ingredients: 'ಪದಾರ್ಥಗಳು',
  cook: 'ಅಡುಗೆ',
  vegetarian: '🥗 ಸಸ್ಯಾಹಾರಿ',
  translateRecipe: 'ರೆಸಿಪಿ ಅನುವಾದಿಸಿ',
};

const ML: Partial<Translations> = {
  addGroceries: 'പലചരക്ക് ചേർക്കുക',
  yourPantry: 'നിങ്ങളുടെ പാൻട്രി',
  signIn: 'Google ഉപയോഗിച്ച് തുടരുക',
  nutrition: 'പോഷകാഹാരം',
  calories: 'കലോറി',
  ingredients: 'ചേരുവകൾ',
  cook: 'പാചകം',
  vegetarian: '🥗 സസ്യഭക്ഷണം',
  translateRecipe: 'റെസിപ്പി വിവർത്തനം ചെയ്യുക',
};

const PA: Partial<Translations> = {
  addGroceries: 'ਕਰਿਆਨਾ ਜੋੜੋ',
  yourPantry: 'ਤੁਹਾਡੀ ਪੈਂਟਰੀ',
  signIn: 'Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ',
  nutrition: 'ਪੋਸ਼ਣ',
  calories: 'ਕੈਲੋਰੀ',
  ingredients: 'ਸਮੱਗਰੀ',
  cook: 'ਖਾਣਾ',
  vegetarian: '🥗 ਸ਼ਾਕਾਹਾਰੀ',
  translateRecipe: 'ਵਿਅੰਜਨ ਅਨੁਵਾਦ ਕਰੋ',
};

const TRANSLATION_MAP: Partial<Record<LangCode, Partial<Translations>>> = {
  en: EN, hi: HI, bn: BN, te: TE, ta: TA, mr: MR, gu: GU, kn: KN, ml: ML, pa: PA,
};

export function t(key: TranslationKey, lang: LangCode): string {
  const langStrings = TRANSLATION_MAP[lang];
  if (langStrings && key in langStrings) {
    return (langStrings as Record<string, string>)[key];
  }
  return EN[key];
}
