"use client"
import { useState } from "react"

export default function WhatsAppClient() {
  const [instanceName, setInstanceName] = useState("")
  const [instanceSecret, setInstanceSecret] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [message, setMessage] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const getHeaders = () => {
    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Workspace-Id': workspace?._id || workspace?.id
    };
  };

  const testConnection = async () => {
    setLoading(true)
    setResult(null)

    console.log("=== FRONTEND DEBUG ===")
    console.log("instanceName:", instanceName)
    console.log("instanceSecret:", instanceSecret ? "***" : "VIDE")

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app'}/api/ecom/integrations/whatsapp/test-connection`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ instanceName, instanceSecret })
      })

      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        connected: false
      })
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    setLoading(true)
    setResult(null)

    console.log("=== FRONTEND DEBUG - ENVOI MESSAGE ===")
    console.log("instanceName:", instanceName)
    console.log("instanceSecret:", instanceSecret ? "***" : "VIDE")
    console.log("phoneNumber:", phoneNumber)
    console.log("message:", message)

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app'}/api/ecom/integrations/whatsapp/send-message`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ instanceName, instanceSecret, phoneNumber, message })
      })

      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        sent: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ background: "#1976d2", color: "white", padding: 20, borderRadius: 8, marginBottom: 30 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>🔌 CLIENT WHATSAPP</h1>
        <p style={{ margin: "10px 0 0 0", opacity: 0.9 }}>
          Test de connexion et envoi de messages via Evolution API
        </p>
      </div>

      <div style={{ background: "white", padding: 30, borderRadius: 8, border: "1px solid #ddd", marginBottom: 30 }}>
        <h2 style={{ marginTop: 0 }}>🔧 Configuration de l'instance</h2>
        
        <input
          placeholder="Nom de l'instance (ex: ALDI)"
          value={instanceName}
          onChange={(e) => setInstanceName(e.target.value.trim())}
          style={{ 
            padding: 12, 
            width: "100%", 
            fontSize: 14,
            border: "2px solid #ddd",
            borderRadius: 5,
            marginBottom: 15,
            boxSizing: "border-box"
          }}
        />

        <input
          type="password"
          placeholder="Secret de l'instance (clé API)"
          value={instanceSecret}
          onChange={(e) => setInstanceSecret(e.target.value.trim())}
          style={{ 
            padding: 12, 
            width: "100%", 
            fontSize: 14,
            border: "2px solid #ddd",
            borderRadius: 5,
            marginBottom: 15,
            boxSizing: "border-box"
          }}
        />

        <button 
          onClick={testConnection} 
          disabled={loading || !instanceName || !instanceSecret}
          style={{ 
            padding: "12px 24px", 
            background: loading ? "#ccc" : "#1976d2", 
            color: "white", 
            border: "none", 
            borderRadius: 5, 
            cursor: loading ? "wait" : "pointer",
            fontSize: 16,
            fontWeight: "bold",
            width: "100%",
            opacity: (!instanceName || !instanceSecret) ? 0.5 : 1
          }}
        >
          {loading ? "⏳ Test en cours..." : "🔌 Tester la connexion"}
        </button>
      </div>

      <div style={{ background: "white", padding: 30, borderRadius: 8, border: "1px solid #ddd", marginBottom: 30 }}>
        <h2 style={{ marginTop: 0 }}>📱 Envoyer un message WhatsApp</h2>
        
        <input
          placeholder="Numéro de téléphone (ex: +33612345678)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value.trim())}
          style={{ 
            padding: 12, 
            width: "100%", 
            fontSize: 14,
            border: "2px solid #ddd",
            borderRadius: 5,
            marginBottom: 15,
            boxSizing: "border-box"
          }}
        />

        <textarea
          placeholder="Votre message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ 
            padding: 12, 
            width: "100%", 
            fontSize: 14,
            border: "2px solid #ddd",
            borderRadius: 5,
            marginBottom: 15,
            boxSizing: "border-box",
            minHeight: "100px",
            resize: "vertical"
          }}
        />

        <button 
          onClick={sendMessage} 
          disabled={loading || !instanceName || !instanceSecret || !phoneNumber || !message}
          style={{ 
            padding: "12px 24px", 
            background: loading ? "#ccc" : "#4caf50", 
            color: "white", 
            border: "none", 
            borderRadius: 5, 
            cursor: loading ? "wait" : "pointer",
            fontSize: 16,
            fontWeight: "bold",
            width: "100%",
            opacity: (!instanceName || !instanceSecret || !phoneNumber || !message) ? 0.5 : 1
          }}
        >
          {loading ? "⏳ Envoi en cours..." : "📱 Envoyer le message"}
        </button>
      </div>

      {/* Messages de succès */}
      {result?.success && result.sent && (
        <div style={{ marginTop: 30, padding: 25, background: "#e8f5e9", borderRadius: 8, border: "2px solid #4caf50" }}>
          <h2 style={{ color: "#2e7d32", marginTop: 0 }}>✅ MESSAGE ENVOYÉ</h2>
          <div style={{ fontSize: 15, lineHeight: 1.8 }}>
            <p><b>Instance :</b> <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>{result.instanceName}</code></p>
            <p><b>Numéro :</b> <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>{result.phoneNumber}</code></p>
            <p><b>Message :</b> {result.message}</p>
          </div>
          
          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", padding: 10, background: "#fff", borderRadius: 5 }}>
              🔍 Voir les logs complets
            </summary>
            <pre style={{ background: "#fff", padding: 15, overflow: "auto", borderRadius: 5, fontSize: 12, marginTop: 10, border: "1px solid #ddd" }}>
              {JSON.stringify(result.fullData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {result?.success && result.connected && !result.sent && (
        <div style={{ marginTop: 30, padding: 25, background: "#e8f5e9", borderRadius: 8, border: "2px solid #4caf50" }}>
          <h2 style={{ color: "#2e7d32", marginTop: 0 }}>✅ CONNEXION RÉUSSIE</h2>
          <div style={{ fontSize: 15, lineHeight: 1.8 }}>
            <p><b>Instance :</b> <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 3 }}>{result.instanceId}</code></p>
            <p><b>Status :</b> <span style={{ color: "#2e7d32", fontWeight: "bold" }}>{result.status}</span></p>
            <p><b>Message :</b> {result.message}</p>
          </div>
          
          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", padding: 10, background: "#fff", borderRadius: 5 }}>
              🔍 Voir les logs complets
            </summary>
            <pre style={{ background: "#fff", padding: 15, overflow: "auto", borderRadius: 5, fontSize: 12, marginTop: 10, border: "1px solid #ddd" }}>
              {JSON.stringify(result.fullData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Messages d'erreur */}
      {result && !result.success && (
        <div style={{ marginTop: 30, padding: 25, background: "#ffebee", borderRadius: 8, border: "2px solid #f44336" }}>
          <h2 style={{ color: "#c62828", marginTop: 0 }}>❌ ERREUR</h2>
          <p style={{ fontSize: 15 }}><b>Message :</b> {result.error}</p>
          
          {result.details && (
            <details style={{ marginTop: 15 }}>
              <summary style={{ cursor: "pointer", fontWeight: "bold" }}>Détails de l'erreur</summary>
              <pre style={{ background: "#fff", padding: 10, overflow: "auto", fontSize: 12, marginTop: 10 }}>
                {result.details}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
