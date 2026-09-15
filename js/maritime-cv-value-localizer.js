(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AllonaMaritimeCvValueLocalizer = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const supportedLanguages = new Set(["en", "tr", "az", "ru"]);
  const identityContexts = new Set(["identifier", "contact", "date", "number"]);

  const localizedValues = Object.freeze({
    excellent: { en: "Excellent", tr: "Mükemmel", az: "Əla", ru: "Отлично" },
    veryGood: { en: "Very Good", tr: "Çok İyi", az: "Çox Yaxşı", ru: "Очень хорошо" },
    good: { en: "Good", tr: "İyi", az: "Yaxşı", ru: "Хорошо" },
    average: { en: "Average", tr: "Orta", az: "Orta", ru: "Средний" },
    intermediate: { en: "Intermediate", tr: "Orta Seviye", az: "Orta Səviyyə", ru: "Средний уровень" },
    basic: { en: "Basic", tr: "Temel", az: "Başlanğıc", ru: "Базовый" },
    fluent: { en: "Fluent", tr: "Akıcı", az: "Sərbəst", ru: "Свободно" },
    poor: { en: "Poor", tr: "Zayıf", az: "Zəif", ru: "Слабый" },

    single: { en: "Single", tr: "Bekar", az: "Subay", ru: "Холост" },
    married: { en: "Married", tr: "Evli", az: "Evli", ru: "Женат" },
    divorced: { en: "Divorced", tr: "Boşanmış", az: "Boşanmış", ru: "Разведён" },
    widowed: { en: "Widowed", tr: "Dul", az: "Dul", ru: "Вдовец" },
    separated: { en: "Separated", tr: "Ayrı", az: "Ayrı", ru: "Раздельное проживание" },
    male: { en: "Male", tr: "Erkek", az: "Kişi", ru: "Мужской" },
    female: { en: "Female", tr: "Kadın", az: "Qadın", ru: "Женский" },
    otherGender: { en: "Other", tr: "Diğer", az: "Digər", ru: "Другой" },

    spouse: { en: "Spouse", tr: "Eş", az: "Həyat yoldaşı", ru: "Супруг(а)" },
    mother: { en: "Mother", tr: "Anne", az: "Ana", ru: "Мать" },
    father: { en: "Father", tr: "Baba", az: "Ata", ru: "Отец" },
    brother: { en: "Brother", tr: "Erkek Kardeş", az: "Qardaş", ru: "Брат" },
    sister: { en: "Sister", tr: "Kız Kardeş", az: "Bacı", ru: "Сестра" },
    son: { en: "Son", tr: "Oğul", az: "Oğul", ru: "Сын" },
    daughter: { en: "Daughter", tr: "Kız", az: "Qız", ru: "Дочь" },

    azerbaijan: { en: "Azerbaijan", tr: "Azerbaycan", az: "Azərbaycan", ru: "Азербайджан" },
    turkey: { en: "Turkey", tr: "Türkiye", az: "Türkiyə", ru: "Турция" },
    russia: { en: "Russia", tr: "Rusya", az: "Rusiya", ru: "Россия" },
    georgia: { en: "Georgia", tr: "Gürcistan", az: "Gürcüstan", ru: "Грузия" },
    kazakhstan: { en: "Kazakhstan", tr: "Kazakistan", az: "Qazaxıstan", ru: "Казахстан" },
    uzbekistan: { en: "Uzbekistan", tr: "Özbekistan", az: "Özbəkistan", ru: "Узбекистан" },
    kyrgyzstan: { en: "Kyrgyzstan", tr: "Kırgızistan", az: "Qırğızıstan", ru: "Кыргызстан" },
    turkmenistan: { en: "Turkmenistan", tr: "Türkmenistan", az: "Türkmənistan", ru: "Туркменистан" },
    ukraine: { en: "Ukraine", tr: "Ukrayna", az: "Ukrayna", ru: "Украина" },
    panama: { en: "Panama", tr: "Panama", az: "Panama", ru: "Панама" },
    honduras: { en: "Honduras", tr: "Honduras", az: "Honduras", ru: "Гондурас" },
    greece: { en: "Greece", tr: "Yunanistan", az: "Yunanıstan", ru: "Греция" },
    germany: { en: "Germany", tr: "Almanya", az: "Almaniya", ru: "Германия" },
    azerbaijaniNationality: { en: "Azerbaijani", tr: "Azerbaycanlı", az: "Azərbaycanlı", ru: "Азербайджанец" },
    turkishNationality: { en: "Turkish", tr: "Türk", az: "Türkiyəli", ru: "Турок" },
    russianNationality: { en: "Russian", tr: "Rus", az: "Rus", ru: "Русский" },
    georgianNationality: { en: "Georgian", tr: "Gürcü", az: "Gürcü", ru: "Грузин" },
    kazakhNationality: { en: "Kazakh", tr: "Kazak", az: "Qazax", ru: "Казах" },
    uzbekNationality: { en: "Uzbek", tr: "Özbek", az: "Özbək", ru: "Узбек" },
    kyrgyzNationality: { en: "Kyrgyz", tr: "Kırgız", az: "Qırğız", ru: "Кыргыз" },
    panamanianNationality: { en: "Panamanian", tr: "Panamalı", az: "Panamalı", ru: "Панамец" },
    honduranNationality: { en: "Honduran", tr: "Honduraslı", az: "Honduraslı", ru: "Гондурасец" },

    baku: { en: "Baku", tr: "Bakü", az: "Bakı", ru: "Баку" },
    aghdam: { en: "Aghdam", tr: "Ağdam", az: "Ağdam", ru: "Агдам" },
    ganja: { en: "Ganja", tr: "Gence", az: "Gəncə", ru: "Гянджа" },
    sumgait: { en: "Sumgait", tr: "Sumgayıt", az: "Sumqayıt", ru: "Сумгаит" },
    istanbul: { en: "Istanbul", tr: "İstanbul", az: "İstanbul", ru: "Стамбул" },
    ankara: { en: "Ankara", tr: "Ankara", az: "Ankara", ru: "Анкара" },
    izmir: { en: "Izmir", tr: "İzmir", az: "İzmir", ru: "Измир" },
    heydarAirport: { en: "Heydar Aliyev International Airport", tr: "Haydar Aliyev Uluslararası Havalimanı", az: "Heydər Əliyev Beynəlxalq Hava Limanı", ru: "Международный аэропорт имени Гейдара Алиева" },
    istanbulAirport: { en: "Istanbul Airport", tr: "İstanbul Havalimanı", az: "İstanbul Hava Limanı", ru: "Аэропорт Стамбул" },

    passport: { en: "Passport", tr: "Pasaport", az: "Pasport", ru: "Паспорт" },
    seamanBook: { en: "Seaman's Book", tr: "Gemiadamı Cüzdanı", az: "Dənizçi Kitabçası", ru: "Мореходная книжка" },
    seafarerIdentity: { en: "Seafarer's Identity Document", tr: "Gemiadamı Kimlik Belgesi", az: "Dənizçi Şəxsiyyət Sənədi", ru: "Удостоверение личности моряка" },
    medicalCertificate: { en: "Medical Certificate", tr: "Sağlık Belgesi", az: "Tibbi Arayış", ru: "Медицинское свидетельство" },
    fitForDuty: { en: "Fit for Duty", tr: "Göreve Uygun", az: "Xidmətə Yararlı", ru: "Годен к службе" },
    unlimited: { en: "Unlimited", tr: "Süresiz", az: "Müddətsiz", ru: "Бессрочно" },

    captain: { en: "Captain", tr: "Kaptan", az: "Kapitan", ru: "Капитан" },
    masterMariner: { en: "Master Mariner", tr: "Uzak Yol Kaptanı", az: "Uzaq Səfərlər Kapitanı", ru: "Капитан дальнего плавания" },
    chiefOfficer: { en: "Chief Officer", tr: "Birinci Zabit", az: "Baş Köməkçi", ru: "Старший помощник капитана" },
    secondOfficer: { en: "Second Officer", tr: "İkinci Zabit", az: "İkinci Köməkçi", ru: "Второй помощник капитана" },
    thirdOfficer: { en: "Third Officer", tr: "Üçüncü Zabit", az: "Üçüncü Köməkçi", ru: "Третий помощник капитана" },
    deckOfficer: { en: "Deck Officer", tr: "Güverte Zabiti", az: "Göyərtə Zabiti", ru: "Палубный офицер" },
    deckCadet: { en: "Deck Cadet", tr: "Güverte Stajyeri", az: "Göyərtə Kadeti", ru: "Курсант-судоводитель" },
    chiefEngineer: { en: "Chief Engineer", tr: "Başmühendis", az: "Baş Mühəndis", ru: "Старший механик" },
    secondEngineer: { en: "Second Engineer", tr: "İkinci Mühendis", az: "İkinci Mühəndis", ru: "Второй механик" },
    thirdEngineer: { en: "Third Engineer", tr: "Üçüncü Mühendis", az: "Üçüncü Mühəndis", ru: "Третий механик" },
    fourthEngineer: { en: "Fourth Engineer", tr: "Dördüncü Mühendis", az: "Dördüncü Mühəndis", ru: "Четвёртый механик" },
    engineer: { en: "Engineer", tr: "Mühendis", az: "Mühəndis", ru: "Механик" },
    engineCadet: { en: "Engine Cadet", tr: "Makine Stajyeri", az: "Mexanik Kadeti", ru: "Курсант-механик" },
    electrician: { en: "Electrician", tr: "Elektrikçi", az: "Elektrik", ru: "Электрик" },
    electroTechnicalOfficer: { en: "Electro-Technical Officer", tr: "Elektroteknik Zabiti", az: "Elektrotexniki Zabit", ru: "Электромеханик" },
    bosun: { en: "Bosun", tr: "Lostromo", az: "Bosman", ru: "Боцман" },
    ableSeaman: { en: "Able Seaman", tr: "Usta Gemici", az: "Bacarıqlı Matros", ru: "Квалифицированный матрос" },
    ordinarySeaman: { en: "Ordinary Seaman", tr: "Gemici", az: "Matros", ru: "Матрос" },
    motorman: { en: "Motorman", tr: "Motorcu", az: "Motorçu", ru: "Моторист" },
    oiler: { en: "Oiler", tr: "Yağcı", az: "Yağçı", ru: "Машинист-моторист" },
    fitter: { en: "Fitter", tr: "Fitter", az: "Fitter", ru: "Фиттер" },
    welder: { en: "Welder", tr: "Kaynakçı", az: "Qaynaqçı", ru: "Сварщик" },
    cook: { en: "Cook", tr: "Aşçı", az: "Aşpaz", ru: "Повар" },
    chiefCook: { en: "Chief Cook", tr: "Baş Aşçı", az: "Baş Aşpaz", ru: "Шеф-повар" },
    steward: { en: "Steward", tr: "Kamarot", az: "Stüard", ru: "Стюард" },
    cadet: { en: "Cadet", tr: "Stajyer", az: "Kadet", ru: "Кадет" },

    brown: { en: "Brown", tr: "Kahverengi", az: "Qəhvəyi", ru: "Карий" },
    black: { en: "Black", tr: "Siyah", az: "Qara", ru: "Чёрный" },
    blue: { en: "Blue", tr: "Mavi", az: "Mavi", ru: "Голубой" },
    green: { en: "Green", tr: "Yeşil", az: "Yaşıl", ru: "Зелёный" },
    hazel: { en: "Hazel", tr: "Ela", az: "Fındıq Rəngi", ru: "Ореховый" },
    grey: { en: "Grey", tr: "Gri", az: "Boz", ru: "Серый" },
    generalCargo: { en: "General Cargo", tr: "Genel Kargo Gemisi", az: "Ümumi Yük Gəmisi", ru: "Сухогруз" },
    bulkCarrier: { en: "Bulk Carrier", tr: "Dökme Yük Gemisi", az: "Quru Yük Gəmisi", ru: "Балкер" },
    containerShip: { en: "Container Ship", tr: "Konteyner Gemisi", az: "Konteyner Gəmisi", ru: "Контейнеровоз" },
    tanker: { en: "Tanker", tr: "Tanker", az: "Tanker", ru: "Танкер" },
    chemicalTanker: { en: "Chemical Tanker", tr: "Kimyasal Tanker", az: "Kimyəvi Tanker", ru: "Химовоз" },
    oilTanker: { en: "Oil Tanker", tr: "Petrol Tankeri", az: "Neft Tankeri", ru: "Нефтяной танкер" },
    tugboat: { en: "Tugboat", tr: "Römorkör", az: "Yedək Gəmisi", ru: "Буксир" }
  });

  const aliases = Object.freeze({
    veryGood: ["çok iyi", "cox yaxsi", "очень хорошо"],
    basic: ["başlangıç", "baslangic", "başlanğıc", "начальный"],
    fluent: ["akici", "sərbəst danışıq", "свободный"],
    single: ["subay", "bekar", "холостой", "не женат"],
    married: ["evli", "женатый", "замужем"],
    male: ["kişi", "kisi", "erkək", "erkek", "m", "м"],
    female: ["qadın", "qadin", "kadın", "kadin", "f", "ж"],
    azerbaijan: ["azərbaycan respublikası", "azerbaycan cumhuriyeti", "republic of azerbaijan"],
    azerbaijaniNationality: ["azərbaycan vətəndaşı", "azerbaycan vatandaşı", "azerbaijani citizen"],
    turkishNationality: ["türkiye cumhuriyeti vatandaşı", "turkish citizen"],
    passport: ["xarici pasport", "seyahat pasaportu", "travel passport"],
    captain: ["gəmi kapitanı", "gemi kaptanı", "ship captain"],
    masterMariner: ["uzaq səfər kapitanı", "uzak yol kaptani", "uzakyol kaptanı"],
    chiefOfficer: ["baş köməkçi", "birinci zabit", "1. zabit", "chief mate", "старпом"],
    secondOfficer: ["ikinci köməkçi", "2. zabit", "second mate"],
    thirdOfficer: ["üçüncü köməkçi", "3. zabit", "third mate"],
    deckOfficer: ["göyərtə zabiti", "guverte zabiti"],
    deckCadet: ["göyərtə kadeti", "guverte stajyeri"],
    chiefEngineer: ["baş mühəndis", "baş muhendis", "chief mechanic"],
    secondEngineer: ["ikinci mühəndis", "ikinci muhendis", "2. mühendis"],
    thirdEngineer: ["üçüncü mühəndis", "ucuncu muhendis", "3. mühendis"],
    fourthEngineer: ["dördüncü mühəndis", "dorduncu muhendis", "4. mühendis"],
    engineer: ["mühəndis", "muhendis", "механик"],
    engineCadet: ["mexanik kadeti", "makine stajyeri"],
    electrician: ["elektrik", "elektrikçi", "elektrikci"],
    electroTechnicalOfficer: ["eto", "elektrotexniki zabit", "elektroteknik zabiti"],
    bosun: ["bosman", "lostromo", "boatswain"],
    ableSeaman: ["ab", "usta gemici", "bacarıqlı matros", "qualified seaman"],
    ordinarySeaman: ["os", "matros", "gemici", "deck rating"],
    motorman: ["motorçu", "motorcu", "motorman oiler", "növbə motorçusu", "novbe motorcusu"],
    oiler: ["yağçı", "yagci", "yağcı"],
    cook: ["aşpaz", "aspaz", "aşçı", "asci", "ship cook", "gəmi aşpazı"],
    chiefCook: ["baş aşpaz", "bas aspaz", "baş aşçı", "bas asci"],
    steward: ["stüard", "stuard", "kamarot"],
    medicalCertificate: ["medical", "sağlık raporu", "tibbi arayış", "медицинская справка"],
    fitForDuty: ["fit", "yararlı", "yararli", "xidmətə yararlı", "годен"],
    generalCargo: ["general cargo ship", "genel kargo", "ümumi yük gəmisi"],
    bulkCarrier: ["dökme yük gemisi", "quru yük gəmisi"],
    containerShip: ["konteyner gəmisi", "konteyner gemisi"],
    tugboat: ["römorkör", "romorkor", "yedək gəmisi"]
  });

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/[’']/g, "'")
      .replace(/ı/g, "i")
      .replace(/ə/g, "e")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ");
  }

  const lookup = new Map();
  Object.entries(localizedValues).forEach(([key, values]) => {
    Object.values(values).forEach(value => lookup.set(normalize(value), key));
    (aliases[key] || []).forEach(value => lookup.set(normalize(value), key));
  });

  const cyrillicToLatinMap = Object.freeze({
    А:"A", а:"a", Б:"B", б:"b", В:"V", в:"v", Г:"G", г:"g", Д:"D", д:"d",
    Е:"E", е:"e", Ё:"Yo", ё:"yo", Ж:"Zh", ж:"zh", З:"Z", з:"z", И:"I", и:"i",
    Й:"Y", й:"y", К:"K", к:"k", Л:"L", л:"l", М:"M", м:"m", Н:"N", н:"n",
    О:"O", о:"o", П:"P", п:"p", Р:"R", р:"r", С:"S", с:"s", Т:"T", т:"t",
    У:"U", у:"u", Ф:"F", ф:"f", Х:"Kh", х:"kh", Ц:"Ts", ц:"ts", Ч:"Ch", ч:"ch",
    Ш:"Sh", ш:"sh", Щ:"Shch", щ:"shch", Ъ:"", ъ:"", Ы:"Y", ы:"y", Ь:"", ь:"",
    Э:"E", э:"e", Ю:"Yu", ю:"yu", Я:"Ya", я:"ya", Ә:"A", ә:"a", Ғ:"Gh", ғ:"gh",
    Ҹ:"J", ҹ:"j", Ө:"O", ө:"o", Ү:"U", ү:"u", Һ:"H", һ:"h", Қ:"G", қ:"g"
  });
  const latinToEnglishMap = Object.freeze({
    Ə:"A", ə:"a", Ş:"Sh", ş:"sh", Ç:"Ch", ç:"ch", Ğ:"Gh", ğ:"gh", İ:"I", ı:"i",
    Ö:"O", ö:"o", Ü:"U", ü:"u"
  });

  function replaceByMap(value, map) {
    return Array.from(String(value || ""), character => map[character] ?? character).join("");
  }

  function toEnglish(value) {
    return replaceByMap(replaceByMap(value, cyrillicToLatinMap), latinToEnglishMap);
  }

  function toTurkish(value) {
    return toEnglish(value)
      .replace(/Kh/g, "H").replace(/kh/g, "h")
      .replace(/Gh/g, "G").replace(/gh/g, "g")
      .replace(/Sh/g, "Ş").replace(/sh/g, "ş")
      .replace(/Ch/g, "Ç").replace(/ch/g, "ç");
  }

  function toAzerbaijani(value) {
    return toEnglish(value)
      .replace(/Kh/g, "X").replace(/kh/g, "x")
      .replace(/Gh/g, "Ğ").replace(/gh/g, "ğ")
      .replace(/Sh/g, "Ş").replace(/sh/g, "ş")
      .replace(/Ch/g, "Ç").replace(/ch/g, "ç");
  }

  function toRussian(value) {
    let converted = toEnglish(value);
    [
      ["Shch", "Щ"], ["shch", "щ"], ["Zh", "Ж"], ["zh", "ж"], ["Kh", "Х"], ["kh", "х"],
      ["Ts", "Ц"], ["ts", "ц"], ["Ch", "Ч"], ["ch", "ч"], ["Sh", "Ш"], ["sh", "ш"],
      ["Yu", "Ю"], ["yu", "ю"], ["Ya", "Я"], ["ya", "я"], ["Yo", "Ё"], ["yo", "ё"],
      ["Gh", "Г"], ["gh", "г"]
    ].forEach(([source, target]) => { converted = converted.split(source).join(target); });
    return replaceByMap(converted, {
      A:"А", a:"а", B:"Б", b:"б", C:"К", c:"к", D:"Д", d:"д", E:"Е", e:"е",
      F:"Ф", f:"ф", G:"Г", g:"г", H:"Х", h:"х", I:"И", i:"и", J:"Дж", j:"дж",
      K:"К", k:"к", L:"Л", l:"л", M:"М", m:"м", N:"Н", n:"н", O:"О", o:"о",
      P:"П", p:"п", Q:"К", q:"к", R:"Р", r:"р", S:"С", s:"с", T:"Т", t:"т",
      U:"У", u:"у", V:"В", v:"в", W:"В", w:"в", X:"Кс", x:"кс", Y:"Й", y:"й",
      Z:"З", z:"з"
    });
  }

  function transliterate(value, targetLanguage) {
    if (targetLanguage === "ru") return toRussian(value);
    if (targetLanguage === "tr") return toTurkish(value);
    if (targetLanguage === "az") return toAzerbaijani(value);
    return toEnglish(value);
  }

  function localize(value, targetLanguage, context) {
    const raw = String(value || "");
    if (!raw || !supportedLanguages.has(targetLanguage)) return raw;
    if (identityContexts.has(context)) return raw;
    if (targetLanguage === "az" && /[Əə]/.test(raw)) return raw;

    if (["proper", "freeText"].includes(context) && raw.includes(",")) {
      return raw.split(",").map(part => {
        const clean = part.trim();
        const key = lookup.get(normalize(clean));
        return key ? localizedValues[key]?.[targetLanguage] || clean : transliterate(clean, targetLanguage);
      }).join(", ");
    }

    if (context !== "name" && context !== "organization" && context !== "vessel") {
      const key = lookup.get(normalize(raw));
      if (key) return localizedValues[key]?.[targetLanguage] || raw;
    }

    return transliterate(raw, targetLanguage);
  }

  return Object.freeze({
    localize,
    normalize,
    supportedLanguages: Object.freeze(Array.from(supportedLanguages)),
    transliterate
  });
});
