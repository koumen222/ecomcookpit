import RitaContact from '../models/RitaContact.js';
import RitaFollowUpCampaign from '../models/RitaFollowUpCampaign.js';
import WhatsAppOrder from '../models/WhatsAppOrder.js';
import { processIncomingMessage } from './ritaAgentService.js';

/**
 * Calcule les contacts éligibles pour une campagne de relance
 */
export async function getEligibleContactsForCampaign(userId, filters) {
  const query = { userId };
  const now = new Date();

  // Filtrer par statut
  if (filters.targetStatus?.length > 0) {
    query.status = { $in: filters.targetStatus };
  }

  // Filtrer par inactivité
  if (filters.minInactiveDays > 0 || filters.maxInactiveDays) {
    const inactivityQuery = {};
    if (filters.minInactiveDays > 0) {
      const minDate = new Date(now.getTime() - filters.minInactiveDays * 24 * 60 * 60 * 1000);
      inactivityQuery.$lte = minDate;
    }
    if (filters.maxInactiveDays) {
      const maxDate = new Date(now.getTime() - filters.maxInactiveDays * 24 * 60 * 60 * 1000);
      inactivityQuery.$gte = maxDate;
    }
    query.lastMessageAt = inactivityQuery;
  }

  // Filtrer par hasOrdered
  if (filters.hasOrdered !== null && filters.hasOrdered !== undefined) {
    query.hasOrdered = filters.hasOrdered;
  }

  // Filtrer par tags
  if (filters.tags?.length > 0) {
    query.tags = { $in: filters.tags };
  }

  // Exclure ceux déjà relancés récemment
  if (filters.excludeRecentFollowUp > 0) {
    const excludeDate = new Date(now.getTime() - filters.excludeRecentFollowUp * 24 * 60 * 60 * 1000);
    query.$or = [
      { lastFollowUpAt: null },
      { lastFollowUpAt: { $lt: excludeDate } }
    ];
  }

  const contacts = await RitaContact.find(query).lean();

  // Filtrer par produits spécifiques si nécessaire
  if (filters.specificProducts?.length > 0) {
    const contactsWithProducts = [];
    for (const contact of contacts) {
      const hasProduct = await WhatsAppOrder.exists({
        userId,
        customerPhone: contact.phone,
        productName: { $in: filters.specificProducts }
      });
      if (hasProduct) {
        contactsWithProducts.push(contact);
      }
    }
    return contactsWithProducts;
  }

  return contacts;
}

/**
 * Crée une nouvelle campagne de relance
 */
export async function createFollowUpCampaign(userId, campaignData) {
  const campaign = new RitaFollowUpCampaign({
    userId,
    ...campaignData,
    status: 'draft'
  });

  // Calculer le nombre de contacts ciblés
  const eligibleContacts = await getEligibleContactsForCampaign(userId, campaignData.filters);
  campaign.targetedCount = eligibleContacts.length;

  await campaign.save();
  return campaign;
}

/**
 * Lance une campagne de relance
 */
export async function startFollowUpCampaign(campaignId) {
  const campaign = await RitaFollowUpCampaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campagne introuvable');
  }

  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    throw new Error('Seules les campagnes en brouillon ou en pause peuvent être lancées');
  }

  campaign.status = 'active';
  campaign.startedAt = new Date();
  await campaign.save();

  // Démarrer le processus d'envoi échelonné
  processFollowUpQueue(campaignId);

  return campaign;
}

/**
 * Pause une campagne active
 */
export async function pauseFollowUpCampaign(campaignId) {
  const campaign = await RitaFollowUpCampaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campagne introuvable');
  }

  campaign.status = 'paused';
  await campaign.save();

  return campaign;
}

/**
 * Traite la file d'attente d'envoi de messages de relance (échelonnement)
 */
async function processFollowUpQueue(campaignId) {
  const campaign = await RitaFollowUpCampaign.findById(campaignId);
  if (!campaign || campaign.status !== 'active') {
    return;
  }

  // Récupérer les contacts éligibles
  const eligibleContacts = await getEligibleContactsForCampaign(campaign.userId, campaign.filters);
  
  // Filtrer ceux déjà traités
  const processedPhones = new Set(campaign.processedContacts.map(c => c.phone));
  const pendingContacts = eligibleContacts.filter(c => !processedPhones.has(c.phone));

  if (pendingContacts.length === 0) {
    // Campagne terminée
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();
    console.log(`✅ [FOLLOW-UP] Campagne ${campaign.name} terminée`);
    return;
  }

  // Calculer combien on peut envoyer aujourd'hui
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentToday = campaign.processedContacts.filter(c => {
    return c.sentAt >= today;
  }).length;

  const remainingToday = campaign.maxMessagesPerDay - sentToday;
  if (remainingToday <= 0) {
    // Limite quotidienne atteinte, réessayer demain
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const delayMs = tomorrow.getTime() - Date.now();
    setTimeout(() => processFollowUpQueue(campaignId), delayMs);
    console.log(`⏰ [FOLLOW-UP] Limite quotidienne atteinte pour ${campaign.name}, reprise demain`);
    return;
  }

  // Envoyer au prochain contact
  const contact = pendingContacts[0];
  await sendFollowUpMessage(campaign, contact);

  // Planifier le prochain envoi
  const delayMs = campaign.delayBetweenMessages * 60 * 1000;
  setTimeout(() => processFollowUpQueue(campaignId), delayMs);
}

/**
 * Envoie un message de relance à un contact
 */
async function sendFollowUpMessage(campaign, contact) {
  try {
    let message = campaign.followUpMessage;

    // Personnaliser le message si useAI est activé
    if (campaign.useAI) {
      // TODO: Utiliser l'IA pour personnaliser le message selon le contexte du contact
      // Pour l'instant, on fait des remplacements simples
      message = message
        .replace('{nom}', contact.nom || contact.pushName || 'vous')
        .replace('{ville}', contact.ville || 'votre ville');
    }

    // Construire le JID WhatsApp
    const jid = `${contact.phone}@s.whatsapp.net`;

    // Envoyer via le service Rita (qui gérera l'envoi WhatsApp)
    // Note: Ici on simule l'envoi, dans la vraie implémentation il faudra intégrer avec le webhook WhatsApp
    console.log(`📤 [FOLLOW-UP] Envoi à ${contact.phone}: ${message.substring(0, 50)}...`);

    // Mettre à jour la campagne
    campaign.processedContacts.push({
      phone: contact.phone,
      sentAt: new Date(),
      responded: false
    });
    campaign.sentCount += 1;
    campaign.lastSentAt = new Date();

    // Mettre à jour le contact
    await RitaContact.updateOne(
      { userId: campaign.userId, phone: contact.phone },
      {
        $set: { 
          lastFollowUpAt: new Date(),
          lastFollowUpMessage: message
        },
        $inc: { followUpCount: 1 }
      }
    );

    await campaign.save();

    return { success: true, contact: contact.phone };
  } catch (error) {
    console.error(`❌ [FOLLOW-UP] Erreur envoi à ${contact.phone}:`, error);
    return { success: false, contact: contact.phone, error: error.message };
  }
}

/**
 * Obtient les statistiques de performance du chatbot
 */
export async function getRitaPerformanceStats(userId, startDate = null, endDate = null) {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const query = { userId };
  if (Object.keys(dateFilter).length > 0) {
    query.createdAt = dateFilter;
  }

  // Statistiques des contacts
  const totalContacts = await RitaContact.countDocuments({ userId });
  const prospects = await RitaContact.countDocuments({ userId, status: 'prospect' });
  const clients = await RitaContact.countDocuments({ userId, status: 'client' });
  const scheduled = await RitaContact.countDocuments({ userId, status: 'scheduled' });

  // Statistiques des commandes
  const totalOrders = await WhatsAppOrder.countDocuments(query);
  const pendingOrders = await WhatsAppOrder.countDocuments({ ...query, status: 'pending' });
  const acceptedOrders = await WhatsAppOrder.countDocuments({ ...query, status: 'accepted' });
  const deliveredOrders = await WhatsAppOrder.countDocuments({ ...query, status: 'delivered' });
  const cancelledOrders = await WhatsAppOrder.countDocuments({ ...query, status: 'cancelled' });

  // Ventes (commandes livrées)
  const totalSales = await WhatsAppOrder.countDocuments({ ...query, isSale: true });
  const salesData = await WhatsAppOrder.aggregate([
    { $match: { ...query, isSale: true } },
    { $group: { _id: null, totalRevenue: { $sum: '$saleAmount' } } }
  ]);
  const totalRevenue = salesData[0]?.totalRevenue || 0;

  // Taux de conversion
  const conversionRate = totalContacts > 0 ? ((totalSales / totalContacts) * 100).toFixed(2) : 0;
  const orderToSaleRate = totalOrders > 0 ? ((totalSales / totalOrders) * 100).toFixed(2) : 0;

  // Commandes programmées
  const scheduledOrdersCount = await WhatsAppOrder.countDocuments({
    ...query,
    scheduledDeliveryDate: { $ne: null, $gte: new Date() }
  });

  return {
    contacts: {
      total: totalContacts,
      prospects,
      clients,
      scheduled,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      accepted: acceptedOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      scheduled: scheduledOrdersCount,
    },
    sales: {
      total: totalSales,
      revenue: totalRevenue,
      conversionRate: parseFloat(conversionRate),
      orderToSaleRate: parseFloat(orderToSaleRate),
    }
  };
}

/**
 * Met à jour le statut d'un contact en fonction de son activité
 */
export async function updateContactStatus(userId, phone) {
  const contact = await RitaContact.findOne({ userId, phone });
  if (!contact) return;

  // Vérifier s'il a des commandes
  const hasOrders = await WhatsAppOrder.exists({ userId, customerPhone: phone });
  const hasSales = await WhatsAppOrder.exists({ userId, customerPhone: phone, isSale: true });
  
  // Vérifier s'il a des commandes programmées
  const hasScheduled = await WhatsAppOrder.exists({
    userId,
    customerPhone: phone,
    scheduledDeliveryDate: { $ne: null, $gte: new Date() }
  });

  let newStatus = 'prospect';
  if (hasScheduled) {
    newStatus = 'scheduled';
  } else if (hasSales) {
    newStatus = 'client';
  } else if (hasOrders) {
    newStatus = 'prospect'; // A commandé mais pas encore livré
  }

  if (contact.status !== newStatus) {
    contact.status = newStatus;
    await contact.save();
  }
}

/**
 * Met à jour les statistiques de vente d'un contact
 */
export async function updateContactSalesStats(userId, phone) {
  const contact = await RitaContact.findOne({ userId, phone });
  if (!contact) return;

  const orders = await WhatsAppOrder.find({ userId, customerPhone: phone });
  const sales = orders.filter(o => o.isSale);

  contact.totalOrders = orders.length;
  contact.totalSales = sales.length;
  
  if (orders.length > 0) {
    contact.lastOrderDate = orders.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt;
  }
  
  if (sales.length > 0) {
    contact.lastSaleDate = sales.sort((a, b) => b.statusUpdatedAt - a.statusUpdatedAt)[0].statusUpdatedAt;
  }

  await contact.save();
}
