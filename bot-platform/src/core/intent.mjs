const intentDefinitions = [
  {
    intent: 'wellbeing',
    priority: 'low',
    keywords: ['nasilsin', 'nasil gidiyor', 'iyi misin', 'keyfin nasil', 'bugun nasilsin']
  },
  {
    intent: 'thanks',
    priority: 'low',
    keywords: ['tesekkur', 'tesekkurler', 'sag ol', 'eyvallah', 'harika']
  },
  {
    intent: 'about_platform',
    priority: 'medium',
    keywords: ['allonahub nedir', 'allona hub nedir', 'allonahub kimdir', 'hakkimizda', 'hakkinda', 'hakkinizda', 'platform nedir', 'ekosistem nedir']
  },
  {
    intent: 'faq_help',
    priority: 'medium',
    keywords: ['sss', 'sikca sorulan', 'sik sorulan', 'en cok sorulan', 'yardim merkezi', 'nasil kullanilir']
  },
  {
    intent: 'career_cv',
    priority: 'medium',
    keywords: ['cv', 'ozgecmis', 'kariyer', 'is basvurusu', 'is ilani', 'is ariyorum', 'cv olustur']
  },
  {
    intent: 'academy',
    priority: 'medium',
    keywords: ['akademi', 'egitim', 'kurs', 'sertifika', 'rehber', 'webinar']
  },
  {
    intent: 'taxi_support',
    priority: 'high',
    keywords: ['taksi', 'yolculuk', 'surucu', 'ucret', 'odeme', 'iptal', 'rota', 'konum']
  },
  {
    intent: 'mall_guide',
    priority: 'medium',
    keywords: ['avm', 'magaza', 'kampanya', 'kupon', 'etkinlik', 'kat', 'otopark', 'calisma saati']
  },
  {
    intent: 'offer',
    priority: 'medium',
    keywords: ['teklif', 'fiyat', 'ucret', 'basvuru', 'randevu', 'gorusme', 'proje']
  },
  {
    intent: 'services',
    priority: 'medium',
    keywords: ['hizmet', 'neler yapiyorsunuz', 'ne sunuyorsunuz', 'anasayfa', 'cozum']
  },
  {
    intent: 'social_media',
    priority: 'medium',
    keywords: ['instagram', 'facebook', 'tiktok', 'linkedin', 'sosyal medya', 'dm', 'yorum', 'paylasim']
  },
  {
    intent: 'legal_policy',
    priority: 'high',
    keywords: ['kvkk', 'gizlilik', 'cerez', 'sozlesme', 'hukuk', 'politika', 'acik riza']
  },
  {
    intent: 'security',
    priority: 'high',
    keywords: ['guvenlik', 'mfa', 'rol', 'yetki', 'token', 'sifre', 'audit', 'log', 'veri ihlali']
  },
  {
    intent: 'partner_support',
    priority: 'medium',
    keywords: ['partner', 'magaza temsilcisi', 'kampanya olustur', 'kupon olustur', 'onay bekliyor']
  },
  {
    intent: 'user_account',
    priority: 'medium',
    keywords: ['hesabim', 'profil', 'bildirim', 'favori', 'kuponlarim', 'yolculuklarim', 'hesap sil']
  },
  {
    intent: 'admin_ops',
    priority: 'medium',
    keywords: ['admin', 'super admin', 'panel', 'dashboard', 'rapor', 'onay kuyrugu']
  },
  {
    intent: 'maritime',
    priority: 'medium',
    keywords: ['denizcilik', 'liman', 'rota', 'filo', 'evrak', 'operasyon', 'teklif al']
  },
  {
    intent: 'support',
    priority: 'medium',
    keywords: ['destek', 'yardim', 'sikayet', 'sorun', 'hata', 'calismiyor', 'ulasamiyorum']
  },
  {
    intent: 'greeting',
    priority: 'low',
    keywords: ['merhaba', 'selam', 'iyi gunler', 'hello']
  },
  {
    intent: 'contact',
    priority: 'medium',
    keywords: ['iletisim', 'ara', 'mail', 'telefon', 'bana donun', 'ulasin']
  }
];

function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyIntent(message) {
  const normalized = normalize(message);
  const scores = intentDefinitions.map((definition) => {
    const hits = definition.keywords.filter((keyword) => normalized.includes(normalize(keyword)));
    return {
      intent: definition.intent,
      priority: definition.priority,
      score: hits.length,
      hits
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const winner = scores[0];

  if (!winner || winner.score === 0) {
    return {
      intent: 'unknown',
      priority: 'low',
      confidence: 0,
      hits: [],
      alternatives: scores.slice(0, 3)
    };
  }

  return {
    intent: winner.intent,
    priority: winner.priority,
    confidence: Math.min(1, 0.35 + winner.score * 0.2),
    hits: winner.hits,
    alternatives: scores.slice(1, 4)
  };
}

export function listIntentDefinitions() {
  return intentDefinitions.map((definition) => ({ ...definition }));
}
