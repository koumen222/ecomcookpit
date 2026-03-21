import React, { useState } from 'react';
import { Smartphone, Plus, Settings, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WhatsAppInstanceSelector from '../components/WhatsAppInstanceSelector.jsx';

const API_BASE = (() => {
  const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
})();

const WhatsAppInstancesList = () => {
  const navigate = useNavigate();
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInstanceSelected = (instance) => {
    setSelectedInstance(instance);
    setShowInstanceSelector(false);
  };

  const handleConfigureNew = () => {
    navigate('/ecom/whatsapp/service');
  };

  const testConnection = async () => {
    if (!selectedInstance) {
      setTestResult({
        success: false,
        message: "Veuillez d'abord sélectionner une instance"
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/ecom/test/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: `Test depuis instance: ${selectedInstance.instanceName || selectedInstance.customName}` 
        })
      });
      
      const data = await response.json();
      setTestResult(data);
      
      // Also test WhatsApp specific status
      const whatsappResponse = await fetch(`${API_BASE}/api/ecom/test/whatsapp-status`);
      const whatsappData = await whatsappResponse.json();
      
      console.log('✅ Test WhatsApp réussi:', data);
      console.log('📱 Status WhatsApp:', whatsappData);
      
    } catch (error) {
      console.error('❌ Erreur test:', error);
      setTestResult({
        success: false,
        message: "❌ Erreur de connexion au backend",
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            Instances WhatsApp
          </h1>
        </div>
        <button
          onClick={handleConfigureNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Nouvelle instance
        </button>
      </div>

      <div className="grid gap-6">
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gestion des instances WhatsApp
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <WhatsAppInstanceSelector
                onInstanceSelected={handleInstanceSelected}
                selectedInstanceId={selectedInstance?._id}
              />
              
              {selectedInstance && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800">
                      Instance sélectionnée : <strong>{selectedInstance.instanceName || selectedInstance.customName || selectedInstance.name}</strong>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={testConnection}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
                    >
                      {loading ? 'Test...' : 'Tester la connexion'}
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {testResult && (
                    <div className={`p-4 rounded-lg border ${
                      testResult.success 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                        <span className="font-medium">{testResult.message}</span>
                      </div>
                      {testResult.response && (
                        <p className="text-sm mt-2">{testResult.response}</p>
                      )}
                      {testResult.error && (
                        <p className="text-sm mt-2 text-red-600">Erreur: {testResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Actions rapides</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/ecom/whatsapp/service')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm font-medium"
              >
                <Settings className="h-4 w-4" />
                Configurer une nouvelle instance
              </button>
              <button
                onClick={() => navigate('/ecom/whatsapp-postulation')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition text-sm font-medium"
              >
                <Smartphone className="h-4 w-4" />
                Postuler pour WhatsApp Business
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInstancesList;
