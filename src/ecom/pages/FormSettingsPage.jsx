import React from 'react';
import { Settings } from 'lucide-react';

const FormSettingsPage = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Settings className="w-5 h-5 text-emerald-600" />
        Paramètres du formulaire
      </h1>
      <p className="text-sm text-gray-500 mt-1">Configurez les paramètres généraux de votre formulaire COD</p>
    </div>
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <Settings className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500 font-medium">Bientôt disponible</p>
      <p className="text-xs text-gray-400 mt-1">Cette fonctionnalité est en cours de développement</p>
    </div>
  </div>
);

export default FormSettingsPage;
