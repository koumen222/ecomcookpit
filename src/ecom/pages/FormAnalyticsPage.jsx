import React from 'react';
import { BarChart3 } from 'lucide-react';

const FormAnalyticsPage = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-emerald-600" />
        Analytique
      </h1>
      <p className="text-sm text-gray-500 mt-1">Suivez les performances de vos formulaires et conversions</p>
    </div>
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500 font-medium">Bientôt disponible</p>
      <p className="text-xs text-gray-400 mt-1">Cette fonctionnalité est en cours de développement</p>
    </div>
  </div>
);

export default FormAnalyticsPage;
