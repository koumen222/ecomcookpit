import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));

await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ MongoDB connecté');

const RitaConfig = (await import('./models/RitaConfig.js')).default;
const configs = await RitaConfig.find({}).lean();
console.log(`\n📊 Configs Rita trouvées: ${configs.length}`);

for (const config of configs) {
  console.log('\n─────────────────────────────');
  console.log(`userId: ${config.userId}`);
  console.log(`enabled: ${config.enabled}`);
  console.log(`bossPhone: ${config.bossPhone || '(vide)'}`);
  console.log(`instanceId: ${config.instanceId || '(vide)'}`);
}

console.log('\n\n🧪 Test Groq API avec config réelle...');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

try {
  const r = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: 'Tu es Rita, vendeuse WhatsApp camerounaise. Répond en 1-2 phrases naturelles en français.' },
      { role: 'user', content: 'Bonjour, vous vendez quoi ?' }
    ],
    temperature: 0.4,
    max_completion_tokens: 4096,
    top_p: 0.95,
    reasoning_effort: 'medium',
  });
  const content = r.choices[0]?.message?.content;
  console.log('✅ Réponse Groq:', content);
  console.log('Finish reason:', r.choices[0]?.finish_reason);
  console.log('Tokens usage:', JSON.stringify(r.usage));
} catch (e) {
  console.error('❌ Erreur Groq:', e.message);
  console.error('Status:', e.status);
}

await mongoose.disconnect();
console.log('\n✅ Diagnostic terminé');
