import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Smartphone, Plus, Settings, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WhatsAppInstanceSelector from '../components/WhatsAppInstanceSelector.jsx';

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
    navigate('/ecom/whatsapp/connexion');
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
      const response = await fetch('http://localhost:8080/api/ecom/test/message', {
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
      const whatsappResponse = await fetch('http://localhost:8080/api/ecom/test/whatsapp-status');
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            Instances WhatsApp
          </h1>
        </div>
        <Button
          onClick={handleConfigureNew}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nouvelle instance
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gestion des instances WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                    <Button
                      onClick={testConnection}
                      disabled={loading}
                      className="flex items-center gap-2"
                      variant="default"
                    >
                      {loading ? 'Test...' : 'Tester la connexion'}
                      <CheckCircle className="h-4 w-4" />
                    </Button>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/ecom/whatsapp/connexion')}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Configurer une nouvelle instance
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/ecom/whatsapp-postulation')}
                className="flex items-center gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Postuler pour WhatsApp Business
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppInstancesList;
