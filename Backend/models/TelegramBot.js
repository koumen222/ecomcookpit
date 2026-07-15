import mongoose from 'mongoose';

/**
 * TelegramBot — un bot Telegram par workspace (via @BotFather).
 *
 * Le marchand colle son bot token ; on valide via getMe, on stocke le bot,
 * et on enregistre un webhook Telegram pointant vers notre endpoint public
 * (/api/ecom/telegram/webhook/:workspaceId), sécurisé par un secret aléatoire
 * renvoyé par Telegram dans l'en-tête X-Telegram-Bot-Api-Secret-Token.
 *
 * Les messages entrants sont routés vers Rita IA (processIncomingMessage),
 * exactement comme WhatsApp, et la réponse repart via l'API sendMessage.
 */
const telegramBotSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
  userId: { type: String, required: true },      // propriétaire (owner de l'agent Rita)
  agentId: { type: String, default: null },      // agent Rita à utiliser (null = défaut)

  botToken: { type: String, required: true },    // secret — jamais renvoyé au front en clair
  botId: { type: String, default: '' },
  botUsername: { type: String, default: '' },
  botFirstName: { type: String, default: '' },

  webhookSecret: { type: String, default: '' },  // vérifie l'authenticité des updates
  isConnected: { type: Boolean, default: false },
  lastError: { type: String, default: null },
  connectedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'telegram_bots' });

const TelegramBot = mongoose.models.TelegramBot || mongoose.model('TelegramBot', telegramBotSchema);
export default TelegramBot;
