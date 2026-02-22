import express from 'express';
import Goal from '../models/Goal.js';
import DailyReport from '../models/DailyReport.js';
import Product from '../models/Product.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// Helper pour obtenir les dates de début et de fin de la semaine
const getWeekRange = (year, week) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = firstDayOfYear.getDay() || 7;
  const start = new Date(year, 0, 1 + (week - 1) * 7 - (daysOffset - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Helper pour obtenir toutes les semaines d'un mois
const getWeeksInMonth = (year, month) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  const processedWeeks = new Set(); // Pour éviter les doublons
  
  console.log(`📅 Analyse du mois: ${month}/${year}, jours: ${lastDay.getDate()}`);
  
  // Parcourir chaque jour du mois pour identifier les semaines
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    const weekNum = getWeekNumber(date);
    const weekKey = `${date.getFullYear()}-W${weekNum}`;
    
    if (!processedWeeks.has(weekKey)) {
      processedWeeks.add(weekKey);
      weeks.push({ weekNumber: weekNum, year: date.getFullYear() });
      console.log(`  📆 Semaine ${weekNum} (${date.getFullYear()}) - Jour ${day}`);
    }
  }
  
  console.log(`📊 Total semaines trouvées: ${weeks.length}`);
  return weeks;
};

// Helper pour obtenir tous les jours d'un mois
const getDaysInMonth = (year, month) => {
  const days = [];
  const lastDay = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= lastDay; day++) {
    days.push(new Date(year, month - 1, day));
  }
  
  return days;
};

// Helper pour obtenir le numéro de semaine ISO-8601
const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

// GET /api/ecom/goals - Liste des objectifs par période
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { periodType = 'weekly', year, month, week, day } = req.query;
    const now = new Date();
    
    let query = { workspaceId: req.workspaceId, periodType };
    let start, end;

    const currentYear = parseInt(year) || now.getFullYear();
    query.year = currentYear;

    if (periodType === 'daily') {
      const selectedDay = day ? new Date(day) : new Date();
      selectedDay.setHours(0, 0, 0, 0);
      start = new Date(selectedDay);
      end = new Date(selectedDay);
      end.setHours(23, 59, 59, 999);
      query.day = { $gte: start, $lte: end };
    } else if (periodType === 'monthly') {
      const currentMonth = parseInt(month) || (now.getMonth() + 1);
      query.month = currentMonth;
      start = new Date(currentYear, currentMonth - 1, 1);
      end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    } else {
      // Weekly par défaut
      const getWeek = (d) => {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      };
      const currentWeek = parseInt(week) || getWeek(now);
      query.weekNumber = currentWeek;
      const range = getWeekRange(currentYear, currentWeek);
      start = range.start;
      end = range.end;
    }

    const goals = await Goal.find(query);

    const enrichedGoals = await Promise.all(goals.map(async (goal) => {
      const matchQuery = { 
        workspaceId: req.workspaceId,
        date: { $gte: start, $lte: end }
      };
      
      if (goal.product) {
        const product = await Product.findOne({ 
          workspaceId: req.workspaceId, 
          name: { $regex: `^${goal.product}$`, $options: 'i' } 
        });
        if (product) matchQuery.productId = product._id;
      }

      const reports = await DailyReport.find(matchQuery).populate('productId');
      
      let totalReceived = 0, totalDelivered = 0, totalRevenue = 0;
      reports.forEach(report => {
        totalReceived += report.ordersReceived || 0;
        totalDelivered += report.ordersDelivered || 0;
        totalRevenue += (report.ordersDelivered || 0) * (report.productId?.sellingPrice || 0);
      });

      let current = 0;
      if (goal.type === 'revenue') current = totalRevenue;
      if (goal.type === 'orders') current = totalReceived;
      if (goal.type === 'delivery_rate') {
        current = totalReceived > 0 ? (totalDelivered / totalReceived) * 100 : 0;
      }
      
      const enrichedGoal = goal.toObject();
      enrichedGoal.currentValue = current;
      enrichedGoal.progress = goal.targetValue > 0 ? (current / goal.targetValue) * 100 : 0;
      enrichedGoal.currentDeliveries = totalDelivered; // Ajouter les livraisons effectuées
      
      return enrichedGoal;
    }));

    res.json({
      success: true,
      data: {
        goals: enrichedGoals,
        period: { periodType, year: currentYear, month, week, day, start, end }
      }
    });
  } catch (error) {
    console.error('Erreur get goals:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/goals - Créer ou mettre à jour un objectif
router.post('/', requireEcomAuth, validateEcomAccess('admin', 'write'), async (req, res) => {
  try {
    const { type, targetValue, periodType, year, month, weekNumber, day, product, deliveryCount } = req.body;
    let start, end;
    const createdGoals = [];

    if (periodType === 'daily') {
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      start = new Date(d);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'monthly') {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59, 999);
      
      // DIVISION AUTOMATIQUE POUR LES OBJECTIFS MENSUELS
      console.log(`🔄 Division automatique de l'objectif mensuel (${targetValue}) en semaines et jours`);
      console.log(`📅 Période: ${month}/${year} du ${start.toISOString()} au ${end.toISOString()}`);
      
      // 1. Créer l'objectif mensuel principal
      const monthlyFilter = { 
        workspaceId: req.workspaceId, 
        periodType, 
        type, 
        product: product || null,
        year,
        month
      };
      
      console.log(`🎯 Création objectif mensuel avec filtre:`, monthlyFilter);
      
      const monthlyGoal = await Goal.findOneAndUpdate(
        monthlyFilter,
        { 
          targetValue, 
          deliveryCount: deliveryCount || null,
          startDate: start, 
          endDate: end,
          year,
          month,
          weekNumber: null,
          day: null,
          status: 'in_progress'
        },
        { upsert: true, new: true }
      );
      createdGoals.push(monthlyGoal);
      console.log(`✅ Objectif mensuel créé: ${monthlyGoal._id}`);
      
      // 2. Créer les objectifs hebdomadaires (division proportionnelle)
      const weeksInMonth = getWeeksInMonth(year, month);
      const weeklyTarget = Math.round(targetValue / weeksInMonth.length);
      
      console.log(`📊 Création de ${weeksInMonth.length} objectifs hebdomadaires avec cible: ${weeklyTarget}`);
      
      for (const week of weeksInMonth) {
        const weekRange = getWeekRange(week.year, week.weekNumber);
        
        // Ajuster la plage si elle dépasse du mois
        const weekStart = weekRange.start < start ? start : weekRange.start;
        const weekEnd = weekRange.end > end ? end : weekRange.end;
        
        console.log(`  📆 Semaine ${week.weekNumber}: ${weekStart.toISOString()} au ${weekEnd.toISOString()}`);
        
        const weeklyFilter = {
          workspaceId: req.workspaceId,
          periodType: 'weekly',
          type,
          product: product || null,
          year: week.year,
          weekNumber: week.weekNumber
        };
        
        const weeklyGoal = await Goal.findOneAndUpdate(
          weeklyFilter,
          {
            targetValue: weeklyTarget,
            deliveryCount: deliveryCount ? Math.round(deliveryCount / weeksInMonth.length) : null,
            startDate: weekStart,
            endDate: weekEnd,
            year: week.year,
            month: month,
            weekNumber: week.weekNumber,
            day: null,
            status: 'in_progress'
          },
          { upsert: true, new: true }
        );
        createdGoals.push(weeklyGoal);
        console.log(`    ✅ Objectif hebdomadaire créé: ${weeklyGoal._id}`);
      }
      
      // 3. Créer les objectifs quotidiens (division proportionnelle)
      const daysInMonth = getDaysInMonth(year, month);
      const dailyTarget = Math.round(targetValue / daysInMonth.length);
      
      console.log(`📅 Création de ${daysInMonth.length} objectifs quotidiens avec cible: ${dailyTarget}`);
      
      for (const dayDate of daysInMonth) {
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dailyFilter = {
          workspaceId: req.workspaceId,
          periodType: 'daily',
          type,
          product: product || null,
          day: dayStart
        };
        
        const dailyGoal = await Goal.findOneAndUpdate(
          dailyFilter,
          {
            targetValue: dailyTarget,
            deliveryCount: deliveryCount ? Math.round(deliveryCount / daysInMonth.length) : null,
            startDate: dayStart,
            endDate: dayEnd,
            year: year,
            month: month,
            weekNumber: getWeekNumber(dayDate),
            day: dayStart,
            status: 'in_progress'
          },
          { upsert: true, new: true }
        );
        createdGoals.push(dailyGoal);
      }
      
      console.log(`✅ Créé ${createdGoals.length} objectifs: 1 mensuel, ${weeksInMonth.length} hebdomadaires, ${daysInMonth.length} quotidiens`);
      
    } else {
      // Cas normal pour les objectifs hebdomadaires
      const range = getWeekRange(year, weekNumber);
      start = range.start;
      end = range.end;
      
      const filter = { 
        workspaceId: req.workspaceId, 
        periodType, 
        type, 
        product: product || null,
        year,
        weekNumber
      };
      
      const goal = await Goal.findOneAndUpdate(
        filter,
        { 
          targetValue, 
          deliveryCount: deliveryCount || null,
          startDate: start, 
          endDate: end,
          year,
          month,
          weekNumber,
          day: null,
          status: 'in_progress'
        },
        { upsert: true, new: true }
      );
      createdGoals.push(goal);
    }

    // Pour la réponse, on retourne le premier objectif créé (le principal)
    const mainGoal = createdGoals[0];
    
    // Recalculer immédiatement la valeur actuelle pour que le frontend puisse mettre à jour la barre
    let current = 0;
    let currentDeliveries = 0; // Nouveau: livraisons effectuées
    const matchQuery = { 
      workspaceId: req.workspaceId,
      date: { $gte: start, $lte: end }
    };
    
    if (mainGoal.product) {
      const product = await Product.findOne({ 
        workspaceId: req.workspaceId, 
        name: { $regex: `^${mainGoal.product}$`, $options: 'i' } 
      });
      if (product) matchQuery.productId = product._id;
    }

    const reports = await DailyReport.find(matchQuery).populate('productId');
    let totalReceived = 0, totalDelivered = 0, totalRevenue = 0;
    reports.forEach(report => {
      totalReceived += report.ordersReceived || 0;
      totalDelivered += report.ordersDelivered || 0;
      totalRevenue += (report.ordersDelivered || 0) * (report.productId?.sellingPrice || 0);
    });

    // Calculer les livraisons effectuées
    currentDeliveries = totalDelivered;

    if (mainGoal.type === 'revenue') current = totalRevenue;
    if (mainGoal.type === 'orders') current = totalReceived;
    if (mainGoal.type === 'delivery_rate') {
      current = totalReceived > 0 ? (totalDelivered / totalReceived) * 100 : 0;
    }

    const goalObj = mainGoal.toObject();
    goalObj.currentValue = current;
    goalObj.progress = mainGoal.targetValue > 0 ? (current / mainGoal.targetValue) * 100 : 0;
    goalObj.currentDeliveries = currentDeliveries; // Ajouter les livraisons effectuées

    // Ajouter une information sur la division si c'est un objectif mensuel
    if (periodType === 'monthly') {
      goalObj.autoDivided = {
        weekly: createdGoals.filter(g => g.periodType === 'weekly').length,
        daily: createdGoals.filter(g => g.periodType === 'daily').length
      };
    }

    res.json({ success: true, data: goalObj });
  } catch (error) {
    console.error('Erreur save goal:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/goals/:id - Supprimer un objectif
router.delete('/:id', requireEcomAuth, validateEcomAccess('admin', 'write'), async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
    res.json({ success: true, message: 'Objectif supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
