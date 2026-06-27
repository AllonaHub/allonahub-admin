import { maskSensitiveText } from '../security/redaction.mjs';

const requiredSlotsByIntent = {
  offer: ['name', 'contact', 'needSummary'],
  contact: ['name', 'contact', 'needSummary'],
  taxi_support: ['tripId', 'issueType', 'contact'],
  mall_guide: ['needSummary'],
  partner_support: ['contact', 'needSummary'],
  user_account: ['contact', 'needSummary'],
  social_media: ['needSummary']
};

const quickReplies = {
  greeting: ['Hizmetleri goster', 'Teklif almak istiyorum', 'Destek talebi ac'],
  services: ['Teklif al', 'Iletisim bilgisi birak', 'AVM modulu', 'Taksi modulu'],
  offer: ['Ad soyad ekle', 'Telefon ekle', 'E-posta ekle', 'Ihtiyac ozeti yaz'],
  taxi_support: ['Yolculuk ID ekle', 'Odeme sorunu', 'Iptal sorunu', 'Acil destek'],
  mall_guide: ['AVM ara', 'Magaza ara', 'Kampanya sor', 'Kupon sor'],
  social_media: ['DM taslagi', 'Yorum siniflandir', 'Paylasim onayi', 'Rapor'],
  legal_policy: ['KVKK', 'Cerez politikasi', 'Insan destegi'],
  security: ['Guvenlik raporu', 'Yetki sorunu', 'Insan destegi'],
  partner_support: ['Kampanya onayi', 'Kupon sorunu', 'Destek talebi'],
  user_account: ['Profil', 'Bildirimler', 'Kuponlarim', 'Destek talebi'],
  admin_ops: ['Onay kuyrugu', 'Raporlar', 'Audit log'],
  maritime: ['Teklif al', 'Liman operasyonu', 'Evrak sureci'],
  unknown: ['Hizmetleri goster', 'Destek talebi ac', 'Insan destegi']
};

function missingSlots(intent, slots) {
  return (requiredSlotsByIntent[intent] ?? []).filter((slot) => !slots?.[slot]);
}

function greetingForTone(tone) {
  if (tone === 'urgent') return 'Durumu oncelikli ele aliyorum.';
  if (tone === 'frustrated') return 'Yasadiginiz sorunu anladim; bunu net ve hizli sekilde toparlayalim.';
  if (tone === 'positive') return 'Memnuniyetle yardimci olayim.';
  return 'Size yardimci olayim.';
}

function askForSlot(slot) {
  switch (slot) {
    case 'name':
      return 'Ad soyad bilgisini paylasir misiniz?';
    case 'contact':
      return 'Size donus yapilacak telefon veya e-posta bilgisini ekler misiniz?';
    case 'tripId':
      return 'Varsa yolculuk ID veya talep numarasini yazar misiniz?';
    case 'needSummary':
      return 'Ihtiyacinizi bir cumleyle netlestirir misiniz?';
    case 'issueType':
      return 'Sorun odeme, iptal, konum, kampanya/kupon veya hesap konularindan hangisiyle ilgili?';
    default:
      return `${slot} bilgisini ekler misiniz?`;
  }
}

function summarizeSlots(slots) {
  const parts = [];
  if (slots.name) parts.push(`Ad: ${slots.name}`);
  if (slots.contact) parts.push(`Iletisim: ${maskSensitiveText(String(slots.contact))}`);
  if (slots.tripId) parts.push(`Yolculuk ID: ${slots.tripId}`);
  if (slots.issueType) parts.push(`Konu: ${slots.issueType}`);
  if (slots.needSummary) parts.push(`Ozet: ${slots.needSummary}`);
  return parts;
}

function smartSourceLine(citations) {
  if (!citations?.length) return '';
  const unique = [...new Set(citations.slice(0, 2).map((citation) => citation.sourcePath))];
  return `Kaynak: ${unique.join(', ')}`;
}

export function buildSmartResponsePlan({
  classification,
  risk,
  ticket,
  knowledgeAnswer,
  customerContext,
  needsHuman
}) {
  const slots = customerContext.slots ?? {};
  const tone = customerContext.lastSentiment?.tone ?? 'neutral';
  const missing = missingSlots(classification.intent, slots);
  const citations = knowledgeAnswer.citations ?? [];
  const sourceLine = smartSourceLine(citations);

  if (risk.hasPromptInjection) {
    return {
      action: 'safe_refusal',
      answer: [
        'Bu istekte sistem kurallarini veya gizli bilgileri hedefleyen ifadeler var.',
        'Guvenlik nedeniyle bu talebi otomatik islemiyorum.',
        ticket ? `Destek kaydi acildi: ${ticket.ticketId}` : 'Konuyu insan destegine aktarabilirim.'
      ].join('\n'),
      quickReplies: quickReplies.security,
      missingSlots: [],
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'security_review' }
    };
  }

  if (risk.hasRiskyAction) {
    return {
      action: 'handoff',
      answer: [
        greetingForTone(tone),
        'Bu istek onay gerektiren riskli bir islem iceriyor.',
        'Odeme, iade, iptal, rol, veri disari aktarma ve yayin islemleri bot tarafindan otomatik yapilmaz.',
        ticket ? `Insan onayi icin destek kaydi acildi: ${ticket.ticketId}` : 'Insan onayi gerekiyor.'
      ].join('\n'),
      quickReplies: quickReplies[classification.intent] ?? quickReplies.unknown,
      missingSlots: missing,
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'human_approval' }
    };
  }

  if (classification.intent === 'greeting') {
    return {
      action: 'answer',
      answer:
        'Merhaba. Hizmet, teklif, taksi destek, AVM rehberi, hesap veya partner konularinda size uygun adimla ilerleyebilirim.',
      quickReplies: quickReplies.greeting,
      missingSlots: [],
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'choose_topic' }
    };
  }

  if (['offer', 'contact'].includes(classification.intent)) {
    if (missing.length > 0) {
      return {
        action: 'ask_followup',
        answer: [
          greetingForTone(tone),
          'Teklif/iletisim talebini kayda hazirliyorum.',
          `Eksik bilgi: ${askForSlot(missing[0])}`,
          ticket ? `On kayit: ${ticket.ticketId}` : ''
        ]
          .filter(Boolean)
          .join('\n'),
        quickReplies: quickReplies.offer,
        missingSlots: missing,
        allowAiEnhancement: false,
        meta: { tone, nextBestAction: `collect_${missing[0]}` }
      };
    }

    return {
      action: 'handoff',
      answer: [
        'Talebi toparladim ve temsilciye aktarilacak hale getirdim.',
        ...summarizeSlots(slots),
        ticket ? `On kayit: ${ticket.ticketId}` : 'Kayit acilmaya hazir.',
        'Bir sonraki adim: temsilci ihtiyaciniza gore teklif veya gorusme icin donus yapacak.'
      ].join('\n'),
      quickReplies: ['Yeni talep ekle', 'Destek durumu sor', 'Baska hizmet sor'],
      missingSlots: [],
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'handoff_to_sales' }
    };
  }

  if (classification.intent === 'taxi_support') {
    return {
      action: 'handoff',
      answer: [
        greetingForTone(tone),
        'Taksi destek konularinda hatali odeme, iade, iptal veya guvenlik islemlerini otomatik yapmam; insan kontrolu gerekir.',
        ticket ? `Destek kaydi acildi: ${ticket.ticketId}` : 'Destek kaydi acmaya hazirim.',
        missing.length > 0 ? `Eksik bilgi: ${askForSlot(missing[0])}` : 'Paylastiginiz bilgiler destek ekibi icin yeterli gorunuyor.',
        sourceLine
      ]
        .filter(Boolean)
        .join('\n'),
      quickReplies: quickReplies.taxi_support,
      missingSlots: missing,
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: missing[0] ? `collect_${missing[0]}` : 'handoff_to_taxi_ops' }
    };
  }

  if (classification.intent === 'mall_guide') {
    return {
      action: 'answer',
      answer: [
        greetingForTone(tone),
        'AVM, magaza, kampanya, kupon ve etkinlik bilgisinde rehberlik edebilirim.',
        knowledgeAnswer.answer,
        'Daha net cevap icin sehir, AVM adi veya magaza/kategori bilgisini yazabilirsiniz.',
        sourceLine
      ]
        .filter(Boolean)
        .join('\n'),
      quickReplies: quickReplies.mall_guide,
      missingSlots: missing,
      allowAiEnhancement: true,
      meta: { tone, nextBestAction: 'ask_location_or_store' }
    };
  }

  if (needsHuman && ticket) {
    return {
      action: 'handoff',
      answer: [
        greetingForTone(tone),
        knowledgeAnswer.answer,
        `Bu konu insan kontrolu gerektiriyor. Destek kaydi acildi: ${ticket.ticketId}`,
        `Sorumlu kuyruk: ${ticket.owner}`,
        sourceLine
      ]
        .filter(Boolean)
        .join('\n'),
      quickReplies: quickReplies[classification.intent] ?? quickReplies.unknown,
      missingSlots: missing,
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'human_review' }
    };
  }

  if (classification.intent === 'unknown') {
    return {
      action: 'ask_followup',
      answer:
        'Konuyu netlestiremedim. Hizmet/teklif, taksi destek, AVM rehberi, hesap, partner veya sosyal medya basliklarindan hangisiyle ilerleyelim?',
      quickReplies: quickReplies.unknown,
      missingSlots: [],
      allowAiEnhancement: false,
      meta: { tone, nextBestAction: 'classify_topic' }
    };
  }

  return {
    action: 'answer',
    answer: [
      greetingForTone(tone),
      knowledgeAnswer.answer,
      sourceLine,
      'Devam etmek isterseniz daha spesifik bilgi yazin; gerekirse destek kaydi acabilirim.'
    ]
      .filter(Boolean)
      .join('\n'),
    quickReplies: quickReplies[classification.intent] ?? quickReplies.unknown,
    missingSlots: missing,
    allowAiEnhancement: true,
    meta: { tone, nextBestAction: missing[0] ? `collect_${missing[0]}` : 'answer_from_knowledge' }
  };
}
