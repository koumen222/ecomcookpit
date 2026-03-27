import React, { useEffect, useState } from 'react';
import { MessageSquare, AlertCircle, Zap } from 'lucide-react';

const PlanLimitsDisplay = ({ plan, limits }) => {
  if (!limits || !limits.label) {
    return null;
  }

  const messagesPerDay = limits.messagesPerDay;
  const messagesPerMonth = limits.messagesPerMonth;
  const isUnlimited = messagesPerDay === null || messagesPerMonth === null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">Plan {limits.label}</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <p className="text-xs text-gray-600">Messages/jour</p>
              <p className="text-lg font-bold text-gray-900">
                {isUnlimited ? '∞' : messagesPerDay?.toLocaleString('fr-FR')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Messages/mois</p>
              <p className="text-lg font-bold text-gray-900">
                {isUnlimited ? '∞' : messagesPerMonth?.toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          {!isUnlimited && (
            <a
              href="/ecom/billing"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Zap className="w-3.5 h-3.5" />
              Passer à Ultra pour l'illimité
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanLimitsDisplay;
