import express from 'express';
import mongoose from 'mongoose';
import StockOrder from '../models/StockOrder.js';
import Product from '../models/Product.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// GET /api/ecom/sourcing/stats - Statistiques complètes sourcing
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;

    // Statistiques des commandes
    const orders = await StockOrder.find({ workspaceId });
    
    // Statistiques produits
    const products = await Product.find({ workspaceId, isActive: true });
    
    // Calculs globaux
    const totalOrders = orders.length;
    const inTransitOrders = orders.filter(o => o.status === 'in_transit');
    const receivedOrders = orders.filter(o => o.status === 'received');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    // Statistiques par sourcing
    const chinaOrders = orders.filter(o => o.sourcing === 'chine');
    const localOrders = orders.filter(o => o.sourcing === 'local');

    // Statistiques de paiement - Chine (uniquement commandes en transit)
    const chinaInTransitOrders = chinaOrders.filter(o => o.status === 'in_transit');
    const chinaPaidPurchase = chinaInTransitOrders.filter(o => o.paidPurchase);
    const chinaPaidTransport = chinaInTransitOrders.filter(o => o.paidTransport);
    const chinaFullyPaid = chinaInTransitOrders.filter(o => o.paidPurchase && o.paidTransport);
    const chinaUnpaid = chinaInTransitOrders.filter(o => !o.paidPurchase && !o.paidTransport);
    const chinaPartiallyPaid = chinaInTransitOrders.filter(o => (o.paidPurchase || o.paidTransport) && !(o.paidPurchase && o.paidTransport));

    // Statistiques de paiement - Local (uniquement commandes en transit)
    const localInTransitOrders = localOrders.filter(o => o.status === 'in_transit');
    const localPaid = localInTransitOrders.filter(o => o.paid);
    const localUnpaid = localInTransitOrders.filter(o => !o.paid);

    // Montants - Chine
    const chinaTotalPurchase = chinaOrders.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const chinaTotalTransport = chinaOrders.reduce((acc, o) => acc + o.transportCost, 0);
    const chinaPaidPurchaseAmount = chinaPaidPurchase.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const chinaPaidTransportAmount = chinaPaidTransport.reduce((acc, o) => acc + o.transportCost, 0);
    const chinaUnpaidPurchaseAmount = chinaOrders.filter(o => !o.paidPurchase).reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const chinaUnpaidTransportAmount = chinaOrders.filter(o => !o.paidTransport).reduce((acc, o) => acc + o.transportCost, 0);

    // Montants - Local
    const localTotalAmount = localOrders.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const localPaidAmount = localPaid.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const localUnpaidAmount = localUnpaid.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);

    // En transit - à prévoir
    const chinaInTransit = inTransitOrders.filter(o => o.sourcing === 'chine');
    const chinaInTransitPurchase = chinaInTransit.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);
    const chinaInTransitTransport = chinaInTransit.reduce((acc, o) => acc + o.transportCost, 0);
    const chinaInTransitTotal = chinaInTransitPurchase + chinaInTransitTransport;

    const localInTransit = inTransitOrders.filter(o => o.sourcing === 'local');
    const localInTransitAmount = localInTransit.reduce((acc, o) => acc + (o.purchasePrice * o.quantity), 0);

    // Statistiques produits
    const totalProducts = products.length;
    const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const totalStockValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.sellingPrice || 0)), 0);
    const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.reorderThreshold || 0));

    // Profit estimé
    const totalPotentialProfit = orders.reduce((acc, o) => {
      if (o.status !== 'cancelled') {
        return acc + ((o.sellingPrice * o.quantity) - (o.purchasePrice * o.quantity) - o.transportCost);
      }
      return acc;
    }, 0);

    res.json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          inTransit: inTransitOrders.length,
          received: receivedOrders.length,
          cancelled: cancelledOrders.length,
          china: chinaOrders.length,
          local: localOrders.length
        },
        payment: {
          china: {
            total: chinaInTransitOrders.length,
            fullyPaid: chinaFullyPaid.length,
            partiallyPaid: chinaPartiallyPaid.length,
            unpaid: chinaUnpaid.length,
            paidPurchase: chinaPaidPurchase.length,
            paidTransport: chinaPaidTransport.length,
            amounts: {
              totalPurchase: chinaTotalPurchase,
              totalTransport: chinaTotalTransport,
              paidPurchase: chinaPaidPurchaseAmount,
              paidTransport: chinaPaidTransportAmount,
              unpaidPurchase: chinaUnpaidPurchaseAmount,
              unpaidTransport: chinaUnpaidTransportAmount
            }
          },
          local: {
            total: localInTransitOrders.length,
            paid: localPaid.length,
            unpaid: localUnpaid.length,
            amounts: {
              total: localTotalAmount,
              paid: localPaidAmount,
              unpaid: localUnpaidAmount
            }
          }
        },
        toPlan: {
          china: {
            orders: chinaInTransit.length,
            purchase: chinaInTransitPurchase,
            transport: chinaInTransitTransport,
            total: chinaInTransitTotal
          },
          local: {
            orders: localInTransit.length,
            total: localInTransitAmount
          },
          grandTotal: chinaInTransitTotal + localInTransitAmount
        },
        products: {
          total: totalProducts,
          totalStock,
          totalStockValue,
          lowStock: lowStockProducts.length,
          lowStockProducts: lowStockProducts.map(p => ({
            _id: p._id,
            name: p.name,
            stock: p.stock,
            reorderThreshold: p.reorderThreshold
          }))
        },
        financial: {
          totalPotentialProfit,
          totalInvested: chinaTotalPurchase + chinaTotalTransport + localTotalAmount,
          totalPaid: chinaPaidPurchaseAmount + chinaPaidTransportAmount + localPaidAmount,
          totalUnpaid: chinaUnpaidPurchaseAmount + chinaUnpaidTransportAmount + localUnpaidAmount
        }
      }
    });
  } catch (error) {
    console.error('Erreur get sourcing stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
