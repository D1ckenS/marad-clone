#!/usr/bin/env node
// M3 — backfill 32 missing keys across 7 web-shore locales.
//
// Idempotent: rerun after adding new keys to en.json and the script
// will fill any new gaps with English placeholders + log them so a
// translator can pick them up.
//
// Uses translations that match the tone of the existing per-locale
// content (sampled from neighbouring keys). Where a string is
// technically maritime (CII MEPC.337, IMO regulation refs) we keep
// the English/numeric content unchanged — that's how the existing
// locale files already handle regulatory refs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '../apps/web-shore/src/locales');

const TRANSLATIONS = {
  ar: {
    'certificates.survey_annual': 'سنوي',
    'certificates.survey_intermediate': 'متوسط',
    'certificates.survey_special': 'خاص',
    'certificates.survey_renewal': 'تجديد',
    'certificates.status_in': 'قيد التنفيذ',
    'certificates.status_tentative': 'مبدئي',
    'certificates.conditions_open': 'مفتوحة',
    'certificates.conditions_closed': 'مغلقة',
    'certificates.log_item': '+ إضافة سجل',
    'certificates.survey_modal.field_certificate': 'شهادة مرتبطة',
    'certificates.survey_modal.no_certificate': '— لا توجد شهادة مرتبطة —',
    'safety.jha_library': 'المكتبة ·',
    'safety.assessments': 'تقييمات',
    'safety.select_jha_hint': 'اختر تحليل مخاطر لعرض المصفوفات والضوابط',
    'safety.risk_critical': 'حرج',
    'safety.risk_intolerable': 'غير محتمل — يلزم تحكم فوري',
    'safety.risk_substantial': 'كبير — يلزم تحكم إضافي',
    'safety.risk_moderate': 'متوسط — تحكم عبر إجراءات SOP/PPE',
    'safety.risk_acceptable': 'مقبول — ضوابط روتينية',
    'safety.without_controls': 'بدون ضوابط',
    'safety.with_controls': 'مع تطبيق الضوابط',
    'qhse.cii_annual_ratio': 'تصنيف CII — نسبة الكفاءة السنوية',
    'qhse.cii_mepc': 'غCO₂ / طن·ميل بحري · IMO MEPC 337(76)',
    'mobile_pair.title': 'اقتران جهاز الجوال',
    'mobile_pair.subtitle':
      'اعرض رمز QR على شاشة الحاسوب وامسحه بتطبيق FleetOps للجوال لتعبئة عنوان API السفينة ومعرف المنظمة في خطوة واحدة.',
    'mobile_pair.base_url_label': 'عنوان API السفينة (يمكن الوصول إليه من هاتف الطاقم)',
    'mobile_pair.base_url_hint':
      'القيمة الافتراضية هي مضيف هذه الصفحة على المنفذ 3001. غيّرها إذا كان api-vessel مرتبطًا بعنوان LAN مختلف.',
    'mobile_pair.tenant_id_label': 'معرّف المنظمة',
    'mobile_pair.scan_instructions':
      'افتح تطبيق FleetOps للجوال، اضغط على "مسح رمز الاقتران" في شاشة تسجيل الدخول، ووجّه الكاميرا إلى هذا الرمز.',
    'mobile_pair.fill_fields_first': 'املأ عنوان API ومعرف المنظمة أعلاه لإنشاء رمز QR.',
    'mobile_pair.manual_entry_summary': 'إظهار النص العادي (للإدخال اليدوي)',
    'mobile_pair.reset_button': 'إعادة تعيين إلى الافتراضي',
  },
  de: {
    'certificates.survey_annual': 'JÄHRLICH',
    'certificates.survey_intermediate': 'ZWISCHEN',
    'certificates.survey_special': 'SONDER',
    'certificates.survey_renewal': 'ERNEUERUNG',
    'certificates.status_in': 'IN',
    'certificates.status_tentative': 'VORLÄUFIG',
    'certificates.conditions_open': 'offen',
    'certificates.conditions_closed': 'geschlossen',
    'certificates.log_item': '+ Eintrag erfassen',
    'certificates.survey_modal.field_certificate': 'Verknüpftes Zertifikat',
    'certificates.survey_modal.no_certificate': '— Kein verknüpftes Zertifikat —',
    'safety.jha_library': 'Bibliothek ·',
    'safety.assessments': 'Bewertungen',
    'safety.select_jha_hint': 'Wählen Sie eine JHA, um Risikomatrizen und Maßnahmen anzuzeigen',
    'safety.risk_critical': 'KRITISCH',
    'safety.risk_intolerable': 'Untragbar — sofortige Kontrolle erforderlich',
    'safety.risk_substantial': 'Erheblich — zusätzliche Kontrolle erforderlich',
    'safety.risk_moderate': 'Mäßig — Kontrolle über SOPs/PSA',
    'safety.risk_acceptable': 'Akzeptabel — Routinekontrollen',
    'safety.without_controls': 'OHNE MASSNAHMEN',
    'safety.with_controls': 'MIT ANGEWANDTEN MASSNAHMEN',
    'qhse.cii_annual_ratio': 'CII-Bewertung — jährliche Effizienzquote',
    'qhse.cii_mepc': 'gCO₂ / t·sm · IMO MEPC 337(76)',
    'mobile_pair.title': 'Mobilgerät koppeln',
    'mobile_pair.subtitle':
      'QR-Code auf dem Laptop-Bildschirm anzeigen und mit der FleetOps-Mobile-App scannen, um Schiffs-API-URL und Mandanten-ID in einem Schritt zu übernehmen.',
    'mobile_pair.base_url_label': 'Schiffs-API-URL (vom Crew-Telefon erreichbar)',
    'mobile_pair.base_url_hint':
      'Standardmäßig der Host dieser Seite auf Port 3001. Ändern, wenn api-vessel an eine andere LAN-Adresse gebunden ist.',
    'mobile_pair.tenant_id_label': 'Mandanten-ID',
    'mobile_pair.scan_instructions':
      'Öffnen Sie die FleetOps-Mobile-App, tippen Sie auf „Kopplungs-QR scannen" im Anmeldebildschirm und richten Sie die Kamera auf diesen Code.',
    'mobile_pair.fill_fields_first':
      'API-URL und Mandanten-ID oben ausfüllen, um den QR-Code zu erzeugen.',
    'mobile_pair.manual_entry_summary': 'Klartext anzeigen (zur manuellen Eingabe)',
    'mobile_pair.reset_button': 'Auf Standard zurücksetzen',
  },
  el: {
    'certificates.survey_annual': 'ΕΤΗΣΙΑ',
    'certificates.survey_intermediate': 'ΕΝΔΙΑΜΕΣΗ',
    'certificates.survey_special': 'ΕΙΔΙΚΗ',
    'certificates.survey_renewal': 'ΑΝΑΝΕΩΣΗ',
    'certificates.status_in': 'ΣΕ',
    'certificates.status_tentative': 'ΠΡΟΣΩΡΙΝΟ',
    'certificates.conditions_open': 'ανοιχτές',
    'certificates.conditions_closed': 'κλειστές',
    'certificates.log_item': '+ Καταχώριση',
    'certificates.survey_modal.field_certificate': 'Συνδεδεμένο πιστοποιητικό',
    'certificates.survey_modal.no_certificate': '— Κανένα συνδεδεμένο πιστοποιητικό —',
    'safety.jha_library': 'Βιβλιοθήκη ·',
    'safety.assessments': 'αξιολογήσεις',
    'safety.select_jha_hint': 'Επιλέξτε JHA για προβολή πινάκων κινδύνου και ελέγχων',
    'safety.risk_critical': 'ΚΡΙΣΙΜΟ',
    'safety.risk_intolerable': 'Μη ανεκτό — απαιτείται άμεσος έλεγχος',
    'safety.risk_substantial': 'Σημαντικό — απαιτείται επιπλέον έλεγχος',
    'safety.risk_moderate': 'Μέτριο — έλεγχος μέσω SOP/PPE',
    'safety.risk_acceptable': 'Αποδεκτό — τακτικοί έλεγχοι',
    'safety.without_controls': 'ΧΩΡΙΣ ΕΛΕΓΧΟΥΣ',
    'safety.with_controls': 'ΜΕ ΕΦΑΡΜΟΣΜΕΝΟΥΣ ΕΛΕΓΧΟΥΣ',
    'qhse.cii_annual_ratio': 'Βαθμολογία CII — ετήσιος λόγος απόδοσης',
    'qhse.cii_mepc': 'gCO₂ / t·nm · IMO MEPC 337(76)',
    'mobile_pair.title': 'Σύζευξη κινητής συσκευής',
    'mobile_pair.subtitle':
      'Εμφανίστε αυτό το QR στην οθόνη του φορητού και σαρώστε το με την εφαρμογή FleetOps για κινητά για να συμπληρωθούν το URL του API του πλοίου και το ID της εταιρείας σε ένα βήμα.',
    'mobile_pair.base_url_label': 'URL API πλοίου (προσβάσιμο από το κινητό του πληρώματος)',
    'mobile_pair.base_url_hint':
      'Προεπιλογή είναι ο host αυτής της σελίδας στη θύρα 3001. Αλλάξτε το αν το api-vessel είναι δεσμευμένο σε διαφορετική διεύθυνση LAN.',
    'mobile_pair.tenant_id_label': 'ID Εταιρείας',
    'mobile_pair.scan_instructions':
      'Ανοίξτε την εφαρμογή FleetOps για κινητά, πατήστε «Σάρωση QR σύζευξης» στην οθόνη σύνδεσης και στρέψτε την κάμερα σε αυτόν τον κωδικό.',
    'mobile_pair.fill_fields_first':
      'Συμπληρώστε το URL του API και το ID Εταιρείας για να δημιουργηθεί ο QR.',
    'mobile_pair.manual_entry_summary': 'Εμφάνιση απλού κειμένου (για χειροκίνητη εισαγωγή)',
    'mobile_pair.reset_button': 'Επαναφορά στις προεπιλογές',
  },
  nl: {
    'certificates.survey_annual': 'JAARLIJKS',
    'certificates.survey_intermediate': 'TUSSENTIJDS',
    'certificates.survey_special': 'SPECIAAL',
    'certificates.survey_renewal': 'VERNIEUWING',
    'certificates.status_in': 'IN',
    'certificates.status_tentative': 'VOORLOPIG',
    'certificates.conditions_open': 'open',
    'certificates.conditions_closed': 'gesloten',
    'certificates.log_item': '+ Item registreren',
    'certificates.survey_modal.field_certificate': 'Gekoppeld certificaat',
    'certificates.survey_modal.no_certificate': '— Geen gekoppeld certificaat —',
    'safety.jha_library': 'Bibliotheek ·',
    'safety.assessments': 'beoordelingen',
    'safety.select_jha_hint': 'Selecteer een JHA om risicomatrices en maatregelen te zien',
    'safety.risk_critical': 'KRITIEK',
    'safety.risk_intolerable': 'Onaanvaardbaar — onmiddellijke controle vereist',
    'safety.risk_substantial': 'Aanzienlijk — extra controle nodig',
    'safety.risk_moderate': 'Matig — controle via SOPs/PBM',
    'safety.risk_acceptable': 'Aanvaardbaar — routinecontroles',
    'safety.without_controls': 'ZONDER MAATREGELEN',
    'safety.with_controls': 'MET TOEGEPASTE MAATREGELEN',
    'qhse.cii_annual_ratio': 'CII-classificatie — jaarlijkse efficiëntieverhouding',
    'qhse.cii_mepc': 'gCO₂ / t·zm · IMO MEPC 337(76)',
    'mobile_pair.title': 'Mobiel apparaat koppelen',
    'mobile_pair.subtitle':
      'Toon deze QR op het laptopscherm en scan deze met de FleetOps-mobiele app om de schips-API-URL en tenant-ID in één stap in te vullen.',
    'mobile_pair.base_url_label': 'Schips-API-URL (bereikbaar vanaf de telefoon van de bemanning)',
    'mobile_pair.base_url_hint':
      'Standaard de host van deze pagina op poort 3001. Wijzig dit als de api-vessel aan een ander LAN-adres is gebonden.',
    'mobile_pair.tenant_id_label': 'Tenant-ID',
    'mobile_pair.scan_instructions':
      'Open de FleetOps-mobiele app, tik op "Koppelings-QR scannen" in het aanmeldscherm en richt de camera op deze code.',
    'mobile_pair.fill_fields_first':
      'Vul de API-URL en tenant-ID hierboven in om de QR te genereren.',
    'mobile_pair.manual_entry_summary': 'Toon platte tekst (voor handmatige invoer)',
    'mobile_pair.reset_button': 'Herstel standaardwaarden',
  },
  ru: {
    'certificates.survey_annual': 'ЕЖЕГОДНОЕ',
    'certificates.survey_intermediate': 'ПРОМЕЖУТОЧНОЕ',
    'certificates.survey_special': 'СПЕЦИАЛЬНОЕ',
    'certificates.survey_renewal': 'ОБНОВЛЕНИЕ',
    'certificates.status_in': 'В',
    'certificates.status_tentative': 'ПРЕДВАРИТЕЛЬНО',
    'certificates.conditions_open': 'открытые',
    'certificates.conditions_closed': 'закрытые',
    'certificates.log_item': '+ Добавить запись',
    'certificates.survey_modal.field_certificate': 'Связанный сертификат',
    'certificates.survey_modal.no_certificate': '— Нет связанного сертификата —',
    'safety.jha_library': 'Библиотека ·',
    'safety.assessments': 'оценок',
    'safety.select_jha_hint': 'Выберите JHA для просмотра матриц рисков и мер',
    'safety.risk_critical': 'КРИТИЧЕСКИЙ',
    'safety.risk_intolerable': 'Недопустимый — требуется немедленный контроль',
    'safety.risk_substantial': 'Существенный — нужен дополнительный контроль',
    'safety.risk_moderate': 'Умеренный — контроль через SOP/СИЗ',
    'safety.risk_acceptable': 'Приемлемый — рутинный контроль',
    'safety.without_controls': 'БЕЗ МЕР',
    'safety.with_controls': 'С ПРИМЕНЁННЫМИ МЕРАМИ',
    'qhse.cii_annual_ratio': 'Рейтинг CII — годовой коэффициент эффективности',
    'qhse.cii_mepc': 'гCO₂ / т·миль · IMO MEPC 337(76)',
    'mobile_pair.title': 'Сопряжение мобильного устройства',
    'mobile_pair.subtitle':
      'Покажите этот QR-код на экране ноутбука и отсканируйте его мобильным приложением FleetOps, чтобы за один шаг заполнить URL API судна и идентификатор организации.',
    'mobile_pair.base_url_label': 'URL API судна (доступный с телефона экипажа)',
    'mobile_pair.base_url_hint':
      'По умолчанию хост этой страницы на порту 3001. Измените, если api-vessel привязан к другому LAN-адресу.',
    'mobile_pair.tenant_id_label': 'Идентификатор организации',
    'mobile_pair.scan_instructions':
      'Откройте мобильное приложение FleetOps, нажмите «Сканировать QR сопряжения» на экране входа и наведите камеру на этот код.',
    'mobile_pair.fill_fields_first':
      'Заполните URL API и идентификатор организации выше, чтобы создать QR.',
    'mobile_pair.manual_entry_summary': 'Показать обычный текст (для ручного ввода)',
    'mobile_pair.reset_button': 'Сбросить к значениям по умолчанию',
  },
  tl: {
    'certificates.survey_annual': 'TAUNAN',
    'certificates.survey_intermediate': 'INTERMEDIATE',
    'certificates.survey_special': 'ESPESYAL',
    'certificates.survey_renewal': 'PAGBABAGO',
    'certificates.status_in': 'NASA',
    'certificates.status_tentative': 'PROBISYUNAL',
    'certificates.conditions_open': 'bukas',
    'certificates.conditions_closed': 'sarado',
    'certificates.log_item': '+ Mag-log ng item',
    'certificates.survey_modal.field_certificate': 'Naka-link na sertipiko',
    'certificates.survey_modal.no_certificate': '— Walang naka-link na sertipiko —',
    'safety.jha_library': 'Aklatan ·',
    'safety.assessments': 'mga pagtatasa',
    'safety.select_jha_hint': 'Pumili ng JHA para tingnan ang risk matrices at kontrol',
    'safety.risk_critical': 'KRITIKAL',
    'safety.risk_intolerable': 'Hindi katanggap-tanggap — agarang kontrol kinakailangan',
    'safety.risk_substantial': 'Substansyal — kailangan ng karagdagang kontrol',
    'safety.risk_moderate': 'Katamtaman — kontrol sa pamamagitan ng SOP/PPE',
    'safety.risk_acceptable': 'Katanggap-tanggap — pang-araw-araw na kontrol',
    'safety.without_controls': 'WALANG KONTROL',
    'safety.with_controls': 'NA MAY KONTROL NA INILAPAT',
    'qhse.cii_annual_ratio': 'CII rating — taunang efficiency ratio',
    'qhse.cii_mepc': 'gCO₂ / t·nm · IMO MEPC 337(76)',
    'mobile_pair.title': 'Pagpapares ng mobile device',
    'mobile_pair.subtitle':
      'Ipakita ang QR na ito sa laptop screen at i-scan ito gamit ang FleetOps mobile app para mapunan ang vessel API URL at tenant ID sa isang hakbang.',
    'mobile_pair.base_url_label': 'Vessel API URL (maa-access mula sa telepono ng tripulante)',
    'mobile_pair.base_url_hint':
      'Default ay ang host ng pahinang ito sa port 3001. Baguhin kung ang api-vessel ay nakakabit sa ibang LAN address.',
    'mobile_pair.tenant_id_label': 'Tenant ID',
    'mobile_pair.scan_instructions':
      'Buksan ang FleetOps mobile app, i-tap ang "Scan pairing QR" sa login screen, at ituro ang camera sa code na ito.',
    'mobile_pair.fill_fields_first': 'Punan ang API URL at tenant ID sa itaas para mabuo ang QR.',
    'mobile_pair.manual_entry_summary': 'Ipakita ang plain text (para sa manu-manong pag-input)',
    'mobile_pair.reset_button': 'I-reset sa defaults',
  },
  zh: {
    'certificates.survey_annual': '年度',
    'certificates.survey_intermediate': '中期',
    'certificates.survey_special': '特别',
    'certificates.survey_renewal': '续证',
    'certificates.status_in': '进行中',
    'certificates.status_tentative': '暂定',
    'certificates.conditions_open': '未结',
    'certificates.conditions_closed': '已结',
    'certificates.log_item': '+ 添加记录',
    'certificates.survey_modal.field_certificate': '关联证书',
    'certificates.survey_modal.no_certificate': '— 无关联证书 —',
    'safety.jha_library': '资源库 ·',
    'safety.assessments': '项评估',
    'safety.select_jha_hint': '选择 JHA 以查看风险矩阵和控制措施',
    'safety.risk_critical': '关键',
    'safety.risk_intolerable': '不可接受 — 需立即采取控制',
    'safety.risk_substantial': '较高 — 需要额外控制',
    'safety.risk_moderate': '中等 — 通过 SOP/PPE 控制',
    'safety.risk_acceptable': '可接受 — 常规控制',
    'safety.without_controls': '无控制',
    'safety.with_controls': '已应用控制',
    'qhse.cii_annual_ratio': 'CII 评级 — 年度效率比',
    'qhse.cii_mepc': 'gCO₂ / 吨·海里 · IMO MEPC 337(76)',
    'mobile_pair.title': '移动设备配对',
    'mobile_pair.subtitle':
      '在笔记本电脑屏幕上显示此 QR 码，并使用 FleetOps 移动应用扫描，可一步填入船舶 API URL 和租户 ID。',
    'mobile_pair.base_url_label': '船舶 API URL（船员手机可访问）',
    'mobile_pair.base_url_hint':
      '默认为此页面的主机加端口 3001。如果 api-vessel 绑定到其他 LAN 地址，请修改。',
    'mobile_pair.tenant_id_label': '租户 ID',
    'mobile_pair.scan_instructions':
      '打开 FleetOps 移动应用，在登录界面点击"扫描配对 QR"，将摄像头对准此码。',
    'mobile_pair.fill_fields_first': '填写上面的 API URL 和租户 ID 即可生成 QR。',
    'mobile_pair.manual_entry_summary': '显示明文（用于手动输入）',
    'mobile_pair.reset_button': '重置为默认值',
  },
};

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
let totalAdded = 0;

for (const [locale, dict] of Object.entries(TRANSLATIONS)) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  for (const [key, value] of Object.entries(dict)) {
    if (getPath(json, key) === undefined) {
      setPath(json, key, value);
      added += 1;
    }
  }
  // Catch any *other* EN keys that drifted in without translation
  const enKeys = flatten(en);
  for (const k of enKeys) {
    if (getPath(json, k) === undefined && dict[k] === undefined) {
      setPath(json, k, getPath(en, k));
      added += 1;
      // Side-channel for the translator
      // eslint-disable-next-line no-console
      console.warn(`[${locale}] placeholder (EN): ${k}`);
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  // eslint-disable-next-line no-console
  console.log(`${locale}: +${added}`);
  totalAdded += added;
}
console.log(`Total keys backfilled: ${totalAdded}`);

function flatten(o, p = '') {
  const out = [];
  for (const k of Object.keys(o)) {
    const path = p ? p + '.' + k : k;
    if (typeof o[k] === 'object' && o[k] !== null) out.push(...flatten(o[k], path));
    else out.push(path);
  }
  return out;
}
