begin;

alter table public.marsoh_message_reactions
  drop constraint if exists marsoh_message_reactions_emoji_check;

alter table public.marsoh_message_reactions
  add constraint marsoh_message_reactions_emoji_check
  check (emoji in ('👍', '❤️', '👏', '⚓', '🌊', '💪', '🙏', '🫡', '🚢', '🧭', '✨', '😊'));

update public.marsoh_channels
set name_i18n = jsonb_build_object(
      'tr', 'Dünya Genel', 'az', 'Dünya söhbəti', 'en', 'World Chat',
      'de', 'Weltweiter Chat', 'ru', 'Мировой чат', 'ar', 'المحادثة العالمية',
      'kk', 'Әлемдік чат', 'uz', 'Jahon suhbati', 'ky', 'Дүйнөлүк маек'
    ),
    pinned_notice_i18n = jsonb_build_object(
      'tr', 'Kişisel iletişim bilgisi, iş ilanı veya ücret talebi paylaşmayın.',
      'az', 'Şəxsi əlaqə məlumatı, iş elanı və ya ödəniş tələbi paylaşmayın.',
      'en', 'Do not share personal contact details, job ads, or payment requests.',
      'de', 'Teilen Sie keine persönlichen Kontaktdaten, Stellenanzeigen oder Zahlungsaufforderungen.',
      'ru', 'Не публикуйте личные контакты, вакансии или требования оплаты.',
      'ar', 'لا تشارك بيانات الاتصال الشخصية أو إعلانات الوظائف أو طلبات الدفع.',
      'kk', 'Жеке байланыс деректерін, жұмыс жарнамаларын немесе төлем талаптарын бөліспеңіз.',
      'uz', 'Shaxsiy aloqa ma''lumotlari, ish e''lonlari yoki to''lov talablarini ulashmang.',
      'ky', 'Жеке байланыш маалыматтарын, жумуш жарыяларын же төлөм талаптарын бөлүшпөңүз.'
    ),
    updated_at = now()
where slug = 'world';

update public.marsoh_channels
set name_i18n = name_i18n || case country_code
      when 'TR' then jsonb_build_object(
        'de', 'Raum Türkei', 'ru', 'Комната: Турция', 'ar', 'غرفة تركيا',
        'kk', 'Түркия бөлмесі', 'uz', 'Turkiya xonasi', 'ky', 'Түркия бөлмөсү'
      )
      when 'AZ' then jsonb_build_object(
        'de', 'Raum Aserbaidschan', 'ru', 'Комната: Азербайджан', 'ar', 'غرفة أذربيجان',
        'kk', 'Әзербайжан бөлмесі', 'uz', 'Ozarbayjon xonasi', 'ky', 'Азербайжан бөлмөсү'
      )
      else '{}'::jsonb
    end,
    pinned_notice_i18n = pinned_notice_i18n || jsonb_build_object(
      'de', 'Bleiben Sie respektvoll, sicher und beim Thema Seefahrt.',
      'ru', 'Общайтесь уважительно, безопасно и по морской теме.',
      'ar', 'تحدث باحترام وأمان والتزم بالموضوع البحري.',
      'kk', 'Құрметпен, қауіпсіз және теңіз тақырыбында сөйлесіңіз.',
      'uz', 'Hurmat bilan, xavfsiz va dengiz mavzusida suhbatlashing.',
      'ky', 'Урматтоо менен, коопсуз жана деңиз темасында сүйлөшүңүз.'
    ),
    updated_at = now()
where slug in ('country-tr', 'country-az');

update public.marsoh_topic_cards
set title_i18n = title_i18n || jsonb_build_object(
      'de', 'Heutiges Seethema', 'ru', 'Морская тема дня', 'ar', 'موضوع البحر اليوم',
      'kk', 'Бүгінгі теңіз тақырыбы', 'uz', 'Bugungi dengiz mavzusi', 'ky', 'Бүгүнкү деңиз темасы'
    ),
    body_i18n = body_i18n || jsonb_build_object(
      'de', 'Welche Gewohnheit stärkt die Kommunikation der Besatzung während langer Wachen am besten?',
      'ru', 'Какая привычка лучше всего укрепляет общение экипажа во время длительных вахт?',
      'ar', 'ما العادة التي تعزز تواصل الطاقم بشكل أفضل خلال النوبات الطويلة؟',
      'kk', 'Ұзақ вахталарда экипаж байланысын қай әдет жақсы нығайтады?',
      'uz', 'Uzoq navbatchilikda ekipaj muloqotini qaysi odat eng yaxshi mustahkamlaydi?',
      'ky', 'Узак вахталарда экипаждын байланышын кайсы адат эң жакшы бекемдейт?'
    )
where status = 'active';

commit;
