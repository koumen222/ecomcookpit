import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, MessageSquare, Smartphone } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const API_BASE = (() => {
  const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
  return url.replace(/\/+$/, '');
})();

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
      const response = await fetch(`${API_BASE}/api/ecom/test/status`);
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
      const response = await fetch(`${API_BASE}/api/ecom/test/whatsapp-status`);
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
      const response = await fetch(`${API_BASE}/api/ecom/test/message`, {
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
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              {status?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Status Backend
            </h3>
          </div>
          <div className="p-4">
            {status ? (
              <div className="space-y-2">
                <p className={status.success ? 'text-green-600' : 'text-red-600'}>
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
            <button
              onClick={testBackendStatus}
              disabled={loading}
              className="mt-3 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {loading ? 'Test...' : 'Retester'}
            </button>
          </div>
        </div>

        {/* Status WhatsApp */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Status WhatsApp
            </h3>
          </div>
          <div className="p-4">
            {whatsappStatus ? (
              <div className="space-y-2">
                <p className={whatsappStatus.success ? 'text-green-600' : 'text-red-600'}>
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
            <button
              onClick={testWhatsappStatus}
              className="mt-3 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Retester
            </button>
          </div>
        </div>

        {/* Test Message */}
        <div className="bg-white rounded-lg border shadow-sm md:col-span-2">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Test Communication
            </h3>
          </div>
          <div className="p-4">
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
                <button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
                >
                  Envoyer
                </button>
              </div>
              
              {testResult && (
                <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.response && <p className="text-sm mt-1">{testResult.response}</p>}
                  {testResult.received && <p className="text-sm mt-1">Reçu: "{testResult.received}"</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestBackend;
