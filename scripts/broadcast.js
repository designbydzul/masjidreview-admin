#!/usr/bin/env node

// One-time WhatsApp broadcast via Fonnte API
// Usage:
//   node scripts/broadcast.js              # Dry run (preview only)
//   node scripts/broadcast.js --send       # Actually send
//   FONNTE_TOKEN=xxx node scripts/broadcast.js --send
//   node scripts/broadcast.js --send --token=xxx
//   node scripts/broadcast.js --test=628xxx --token=xxx  # Test send to one number

const USERS = [
  { number: "6281218230764", name: "Affa" },
  { number: "6281213313873", name: "Chibe" },
  { number: "628882326644", name: "Eli" },
  { number: "6285776038941", name: "Zahra" },
  { number: "6285162630430", name: "Farhan Anshori" },
  { number: "6285721868501", name: "Dhea Hallimatu" },
  { number: "6281274755098", name: "Ammar Naufal" },
  { number: "628115986577", name: "Senore Arthomy Amadeus" },
  { number: "6289623479505", name: "Dilla" },
  { number: "6285150903035", name: "duloh" },
  { number: "6289643230308", name: "Lim" },
  { number: "6281312414122", name: "Kadita" },
  { number: "6282139774177", name: "Dzaki Ahmad Syaifullah" },
  { number: "6289655395388", name: "Fadhil Dzikri Muhammad" },
  { number: "6289653486789", name: "Farah Febri Yanti" },
  { number: "6281617005531", name: "Hafidz" },
  { number: "6281320927624", name: "Arif" },
  { number: "62895321526220", name: "Naga" },
  { number: "6283851512988", name: "Annisa" },
  { number: "6287821084158", name: "Herlanggaws" },
  { number: "6281219485823", name: "Amatullah Muthiah" },
  { number: "6281316681355", name: "M. Faruq" },
  { number: "6281369183759", name: "amar" },
  { number: "6285722370954", name: "Lintang Nabilah K" },
  { number: "6289513206824", name: "Adenia Azzahra" },
  { number: "6289666670509", name: "Rudy" },
  { number: "6285959673772", name: "Asfi R" },
  { number: "6281286115494", name: "ghaitza" },
  { number: "6289530717990", name: "Siffa Noorjanah" },
  { number: "6281284522490", name: "Galih Fatihah Ali" },
  { number: "6285156972328", name: "Farell Faiz" },
  { number: "6285242283643", name: "Ugi" },
  { number: "6285117288201", name: "jia" },
  { number: "6281213440185", name: "sabrinaa" },
  { number: "6281224112988", name: "Fahryan Arditama" },
  { number: "62895708369020", name: "Isma Nur Afifah" },
  { number: "62895343168184", name: "M Akbar Nugrahadi" },
  { number: "6285183093673", name: "ف" },
  { number: "6281231471504", name: "Arul" },
  { number: "6289636859452", name: "Calvin" },
  { number: "62895360918397", name: "Khol" },
  { number: "6288229136205", name: "Ratri" },
  { number: "6281211116506", name: "Fisha" },
  { number: "6289661081650", name: "Hielmy Ismet" },
  { number: "6285333056023", name: "Arvind Vazza" },
  { number: "6282315620798", name: "Dzul" },
];

const MESSAGE = `Assalamu'alaikum {name} 🙌

Ada kabar baik! Masjid Review sekarang support login pakai Google.

Karena kamu sudah terdaftar pakai nomor WhatsApp, kami sarankan untuk sambungkan juga akun Google kamu sebagai opsi login tambahan.

Caranya gampang: Buka Profile → Sambungkan Akun Google

👉 masjidreview.id/profile

⚠️ Sudah terlanjur logout? Buka halaman Login → masukkan nomor WhatsApp → lanjutkan dengan Google. Data kamu akan otomatis tersinkron.

Tenang, semua data review dan histori kamu tetap aman.

Jika akun Google dan nomor WhatsApp kamu sudah terhubung, kamu bisa abaikan pesan ini.

Terima kasih sudah menjadi bagian dari Masjid Review 🤍
Tim Masjid Review`;

function isValidName(name) {
  if (name.length <= 1) return false;
  if (!/[a-zA-Z]/.test(name)) return false;
  return true;
}

function buildTargets(users) {
  return users.map((u) => {
    const displayName = isValidName(u.name) ? u.name : "";
    return `${u.number}|${displayName}`;
  });
}

function getToken() {
  const tokenArg = process.argv.find((a) => a.startsWith("--token="));
  if (tokenArg) return tokenArg.split("=")[1];
  return process.env.FONNTE_TOKEN;
}

function getTestNumber() {
  const testArg = process.argv.find((a) => a.startsWith("--test="));
  if (testArg) return testArg.split("=")[1];
  return null;
}

async function main() {
  const shouldSend = process.argv.includes("--send");
  const testNumber = getTestNumber();

  if (testNumber) {
    const token = getToken();
    if (!token) {
      console.error("❌ No token provided. Set FONNTE_TOKEN env var or use --token=xxx\n");
      process.exit(1);
    }

    const target = `${testNumber}|Dzul`;
    console.log(`\n🧪 Test mode — sending to: ${testNumber} (name: Dzul)\n`);
    console.log(`📝 Message template:\n`);
    console.log(MESSAGE);
    console.log();
    console.log("🚀 Sending test message...\n");

    const formData = new URLSearchParams();
    formData.append("target", target);
    formData.append("message", MESSAGE);

    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: formData,
    });

    const data = await res.json();
    console.log("📨 Fonnte API response:\n");
    console.log(JSON.stringify(data, null, 2));
    console.log();
    return;
  }

  const targets = buildTargets(USERS);

  console.log(`\n📋 Broadcast target list (${USERS.length} users):\n`);
  targets.forEach((t, i) => {
    const [num, name] = t.split("|");
    console.log(`  ${String(i + 1).padStart(2)}. ${num} → ${name || "(no name)"}`);
  });

  console.log(`\n📝 Message template:\n`);
  console.log(MESSAGE);
  console.log();

  if (!shouldSend) {
    console.log("ℹ️  Dry run mode. Add --send flag to actually send.\n");
    return;
  }

  const token = getToken();
  if (!token) {
    console.error("❌ No token provided. Set FONNTE_TOKEN env var or use --token=xxx\n");
    process.exit(1);
  }

  console.log("🚀 Sending broadcast...\n");

  const formData = new URLSearchParams();
  formData.append("target", targets.join(","));
  formData.append("message", MESSAGE);
  formData.append("delay", "5");

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token },
    body: formData,
  });

  const data = await res.json();
  console.log("📨 Fonnte API response:\n");
  console.log(JSON.stringify(data, null, 2));
  console.log();
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
