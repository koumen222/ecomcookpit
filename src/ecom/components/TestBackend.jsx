import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, AlertCircle, MessageSquare, Smartphone } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const TestBackend = () => {
  const [status, setStatus] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    testBackendStatus();
    testWhatsappStatus();
  }, []);

  const testBackendStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8080/api/ecom/test/status');
      const data = await response.json();
      setStatus(data);
      console.log('✅ Backend status:', data);
    } catch (error) {
      console.error('❌ Erreur backend status:', error);
      setStatus({
        success: false,
        message: "❌ Backend inaccessible",
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testWhatsappStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/ecom/test/whatsapp-status');
      const data = await response.json();
      setWhatsappStatus(data);
      console.log('✅ WhatsApp status:', data);
    } catch (error) {
      console.error('❌ Erreur WhatsApp status:', error);
      setWhatsappStatus({
        success: false,
        message: "❌ Service WhatsApp indisponible",
        error: error.message
      });
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    try {
      const response = await fetch('http://localhost:8080/api/ecom/test/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      setTestResult(data);
      console.log('✅ Message envoyé:', data);
      setMessage('');
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      setTestResult({
        success: false,
        message: "❌ Erreur lors de l'envoi",
        error: error.message
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <CheckCircle className="h-6 w-6" />
        Test Backend - WhatsApp
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Backend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Status Backend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="space-y-2">
                <p className={status.success ? "text-green-600" : "text-red-600"}>
                  {status.message}
                </p>
                {status.data && (
                  <div className="text-sm text-gray-600">
                    <p>Timestamp: {new Date(status.timestamp).toLocaleString()}</p>
                    <p>Status: {status.data.status}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Chargement...</p>
            )}
            <Button 
              onClick={testBackendStatus} 
              variant="outline" 
              size="sm" 
              className="mt-3"
              disabled={loading}
            >
              {loading ? 'Test...' : 'Retester'}
            </Button>
          </CardContent>
        </Card>

        {/* Status WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Status WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            {whatsappStatus ? (
              <div className="space-y-2">
                <p className={whatsappStatus.success ? "text-green-600" : "text-red-600"}>
                  {whatsappStatus.message}
                </p>
                {whatsappStatus.data && (
                  <div className="text-sm text-gray-600">
                    <p>Status: {whatsappStatus.data.status}</p>
                    <div className="mt-2">
                      <p>Routes disponibles:</p>
                      <ul className="ml-4">
                        {Object.entries(whatsappStatus.data.routes).map(([key, route]) => (
                          <li key={key} className="text-xs">{route}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Chargement...</p>
            )}
            <Button 
              onClick={testWhatsappStatus} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Retester
            </Button>
          </CardContent>
        </Card>

        {/* Test Message */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Test Communication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Entrez un message de test..."
                  className="flex-1 px-3 py-2 border rounded-md"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} disabled={!message.trim()}>
                  Envoyer
                </Button>
              </div>
              
              {testResult && (
                <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.response && <p className="text-sm mt-1">{testResult.response}</p>}
                  {testResult.received && <p className="text-sm mt-1">Reçu: "{testResult.received}"</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestBackend;
