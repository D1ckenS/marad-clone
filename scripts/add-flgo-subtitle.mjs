import fs from 'node:fs';

const subs = {
  nl: "Brandstof · Vloeistoffen · Gas · Olie — peilingen, BDN's en verbruik",
  de: 'Treibstoff · Flüssigkeiten · Gas · Öl — Peilungen, BDNs und Verbrauch',
  ar: 'وقود · سوائل · غاز · زيت — قياسات الخزانات وإشعارات التسليم والاستهلاك',
  el: 'Καύσιμα · Υγρά · Αέρια · Λάδι — μετρήσεις, BDN και κατανάλωση',
  ru: 'Топливо · Жидкости · Газ · Масло — замеры, BDN и расход',
  tl: 'Fuel · Liquids · Gas · Oil — soundings, BDN at consumption',
  zh: '燃料·液体·气体·油 — 测量、加油单和消耗',
};

for (const [lang, sub] of Object.entries(subs)) {
  const p = `apps/web-shore/src/locales/${lang}.json`;
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!obj.flgo) continue;
  if (obj.flgo.subtitle) continue;
  // insert subtitle after title key
  const flgo = {
    title: obj.flgo.title,
    subtitle: sub,
    ...Object.fromEntries(Object.entries(obj.flgo).filter(([k]) => k !== 'title')),
  };
  obj.flgo = flgo;
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  console.log('updated', lang);
}
