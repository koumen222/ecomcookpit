import React, { useState, useEffect } from 'react';
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
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Test Backend - WhatsApp
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Backend */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {status?.success ? (
                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              Status Backend
            </h3>
          </div>
          <div className="px-6 py-4">
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
            <button 
              onClick={testBackendStatus} 
              className="mt-3 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Test...' : 'Retester'}
            </button>
          </div>
        </div>

        {/* Status WhatsApp */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Status WhatsApp
            </h3>
          </div>
          <div className="px-6 py-4">
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
            <button 
              onClick={testWhatsappStatus} 
              className="mt-3 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              Retester
            </button>
          </div>
        </div>

        {/* Test Message */}
        <div className="bg-white rounded-lg shadow border border-gray-200 md:col-span-2">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Test Communication
            </h3>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Entrez un message de test..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button 
                  onClick={sendMessage} 
                  disabled={!message.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
