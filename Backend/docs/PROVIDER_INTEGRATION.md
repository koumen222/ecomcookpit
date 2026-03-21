# 💼 Provider Integration Guide

## Para desarrolladores que quieren usar el sistema Provider

---

## 📋 Tabla de Contenidos

1. [Instalación](#instalación)
2. [Configuración](#configuración)
3. [Autenticación](#autenticación)
4. [Casos de Uso](#casos-de-uso)
5. [SDK & Librerías](#sdk--librerías)
6. [Ejemplos Prácticos](#ejemplos-prácticos)
7. [Troubleshooting](#troubleshooting)

---

## 🛠️ Instalación

### Requisitos
- Node.js >= 14.0
- MongoDB >= 4.0
- API Gateway o acceso directo a `http://localhost:8080/api/provider`

### Setup Inicial

```bash
# 1. Clonar el repositorio
git clone https://github.com/koumen222/ecomcookpit.git
cd ecomcookpit

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp Backend/.env.example Backend/.env

# 4. Iniciar el servidor
cd Backend
node server.js
```

---

## ⚙️ Configuración

### Variables de Entorno

```bash
# .env
MONGO_URI=mongodb://localhost:27017/ecomcookpit
JWT_SECRET=your-secret-key
PROVIDER_API_URL=http://localhost:8080/api/provider

# Email (para verificación)
SENDGRID_API_KEY=...
RESEND_API_KEY=...
```

### Configuración del Provider

```javascript
// Backend/config/provider.js
export const providerConfig = {
  // Token expiration (ms)
  tokenExpiration: 365 * 24 * 60 * 60 * 1000, // 1 year
  
  // Default quotas
  defaultInstanceLimit: 10,
  
  // Email verification
  emailVerificationExpiration: 24 * 60 * 60 * 1000, // 24 hours
  
  // Permissions
  defaultPermissions: [
    'instances:create',
    'instances:read',
    'instances:update',
    'instances:delete',
    'instances:manage'
  ]
};
```

---

## 🔐 Autenticación

### Flujo de Autenticación

```mermaid
graph LR
    A[Cliente] -->|credentials| B[Register]
    B -->|token| A
    A -->|Bearer token| C[API Endpoint]
    C -->|validateToken| D[requireProviderAuth]
    D -->|OK| E[Execute Action]
    E -->|Response| A
```

### Header de Autenticación

```javascript
// Todas las peticiones deben incluir:
const headers = {
  'Authorization': 'Bearer prov_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'Content-Type': 'application/json'
};
```

### Refresh de Token

```javascript
// El token expira cada 1 año
// Para obtener un nuevo token:

async function refreshProviderToken(currentToken) {
  const response = await fetch('http://localhost:8080/api/provider/refresh-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${currentToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.data.token; // Nuevo token
}
```

---

## 🎯 Casos de Uso

### Use Case 1: Agencia Multicliente

**Escenario**: Una agencia de marketing gestiona 50 clientes.
Cada cliente tiene su propia tienda en línea.

```javascript
// 1. Agencia se registra como provider
const agencyToken = await register({
  email: 'agency@marketing.com',
  company: 'Agency Marketing Pro',
  name: 'Manager',
  password: 'secure123'
});

// 2. Por cada cliente, crear una instancia
const clients = [
  { name: 'Client 1', subdomain: 'client1' },
  { name: 'Client 2', subdomain: 'client2' },
  // ... 50 clientes
];

for (const client of clients) {
  const instance = await createInstance(agencyToken, {
    name: client.name,
    subdomain: client.subdomain
  });
  
  // Guardar en base de datos
  await saveClientInstance({
    clientId: client.id,
    instanceId: instance.id,
    accessUrl: instance.accessUrl
  });
}

// 3. Dar acceso a cada cliente (de forma segura)
// Los clientes acceden a su instancia en: https://client1.scalor.net
```

### Use Case 2: Revendedor White Label

**Escenario**: Revendedor quiere ofrecer la plataforma con su branding.

```javascript
// 1. Revendedor = Provider
const revendedor = await register({
  email: 'revendedor@company.com',
  company: 'Reseller Company',
  name: 'founder'
});

// 2. Cliente final compra una instancia
// El revendedor crea la instancia
const customerInstance = await createInstance(revendedor.token, {
  name: 'Customer Business Name',
  subdomain: 'customer-store', // Subdomain único
  settings: {
    currency: 'XAF',
    businessType: 'wholesale'
  }
});

// 3. Cliente accede a su tienda
// https://customer-store.scalor.net
// (Puede tener dominio personalizado después)
```

### Use Case 3: Integración API Automatizada

**Escenario**: Sistema externo necesita provisionar tiendas automáticamente.

```javascript
// 1. Establecer conexión con Provider API
class ProviderAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  
  async createStore(storeData) {
    const response = await fetch(`${this.baseUrl}/instances`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(storeData)
    });
    
    return response.json();
  }
}

const api = new ProviderAPI(
  'http://localhost:8080/api/provider',
  'prov_xxxxx'
);

// 2. Crear tienda cuando el cliente se registra
app.post('/register-store', async (req, res) => {
  const { name, subdomain } = req.body;
  
  const instance = await api.createStore({
    name,
    subdomain,
    settings: { currency: 'XAF' }
  });
  
  res.json({ storeUrl: instance.accessUrl });
});
```

---

## 📚 SDK & Librerías

### JavaScript SDK

```javascript
// provider-sdk.js
export class ProviderSDK {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  
  // Auth
  async register(data) {
    return this.request('POST', '/register', data);
  }
  
  async login(email, password) {
    return this.request('POST', '/login', { email, password });
  }
  
  async verifyEmail(token) {
    return this.request('POST', `/verify-email/${token}`, {});
  }
  
  // Instances
  async createInstance(data) {
    return this.request('POST', '/instances', data);
  }
  
  async listInstances() {
    return this.request('GET', '/instances');
  }
  
  async getInstance(id) {
    return this.request('GET', `/instances/${id}`);
  }
  
  async updateInstance(id, data) {
    return this.request('PUT', `/instances/${id}`, data);
  }
  
  async deleteInstance(id) {
    return this.request('DELETE', `/instances/${id}`);
  }
  
  // Provider info
  async getMe() {
    return this.request('GET', '/me');
  }
  
  async refreshToken() {
    return this.request('POST', '/refresh-token', {});
  }
  
  // Helper
  async request(method, endpoint, data) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (this.token) {
      options.headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const json = await response.json();
    
    if (!response.ok) {
      throw new Error(json.message || 'API Error');
    }
    
    return json;
  }
}
```

### Python SDK

```python
# provider_sdk.py
import requests

class ProviderSDK:
    def __init__(self, base_url, token=None):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()
    
    def _request(self, method, endpoint, data=None):
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        response = self.session.request(
            method,
            url,
            json=data,
            headers=headers
        )
        
        response.raise_for_status()
        return response.json()
    
    # Auth
    def register(self, email, password, company, name):
        return self._request('POST', '/register', {
            'email': email,
            'password': password,
            'company': company,
            'name': name
        })
    
    def login(self, email, password):
        return self._request('POST', '/login', {
            'email': email,
            'password': password
        })
    
    # Instances
    def create_instance(self, name, subdomain, settings=None):
        return self._request('POST', '/instances', {
            'name': name,
            'subdomain': subdomain,
            'settings': settings or {}
        })
    
    def list_instances(self):
        return self._request('GET', '/instances')
    
    def update_instance(self, instance_id, **kwargs):
        return self._request('PUT', f'/instances/{instance_id}', kwargs)
    
    def delete_instance(self, instance_id):
        return self._request('DELETE', f'/instances/{instance_id}')
```

---

## 💻 Ejemplos Prácticos

### Ejemplo 1: Crear múltiples tiendas

```javascript
import { ProviderSDK } from './provider-sdk.js';

async function createStoresForClients() {
  const sdk = new ProviderSDK('http://localhost:8080/api/provider');
  
  // Registro
  const reg = await sdk.register({
    email: 'bulk-creator@company.com',
    password: 'secure123',
    company: 'Bulk Stores Corp',
    name: 'Creator'
  });
  
  sdk.token = reg.provider.apiToken;
  
  // Crear tiendas
  const stores = [
    { name: 'Store A', subdomain: 'store-a' },
    { name: 'Store B', subdomain: 'store-b' },
    { name: 'Store C', subdomain: 'store-c' }
  ];
  
  for (const store of stores) {
    try {
      const instance = await sdk.createInstance(
        store.name,
        store.subdomain
      );
      
      console.log(`✅ Created: ${instance.accessUrl}`);
    } catch (error) {
      console.error(`❌ Failed to create ${store.name}: ${error.message}`);
    }
  }
}

createStoresForClients();
```

### Ejemplo 2: Sistema de cuotas

```javascript
async function checkAndUpgradeQuota(sdk) {
  // Obtener informe
  const provider = await sdk.getMe();
  
  const { stats, limits } = provider.data;
  const { activeInstances, canCreateMoreInstances } = stats;
  const { instanceLimit } = limits;
  
  // Mostrar estado
  console.log(`Instancias activas: ${activeInstances}/${instanceLimit}`);
  
  if (!canCreateMoreInstances) {
    console.log('⚠️ Has alcanzado tu límite. Contacta a soporte para upgrade.');
  } else {
    console.log(`✅ Puedes crear ${instanceLimit - activeInstances} más.`);
  }
}
```

### Ejemplo 3: Dashboard para el Provider

```javascript
async function providerDashboard(token) {
  const sdk = new ProviderSDK('http://localhost:8080/api/provider', token);
  
  // Obtener datos
  const me = await sdk.getMe();
  const instances = await sdk.listInstances();
  
  // Mostrar HTML
  const html = `
    <h1>${me.data.company}</h1>
    <p>Provider: ${me.data.email}</p>
    
    <h2>Estadísticas</h2>
    <p>Instancias activas: ${me.data.stats.activeInstances}</p>
    <p>Límite: ${me.data.limits.instanceLimit}</p>
    
    <h2>Mis Tiendas</h2>
    <ul>
      ${instances.data.instances.map(inst => `
        <li>
          <strong>${inst.name}</strong>
          <a href="${inst.accessUrl}" target="_blank">
            Acceder
          </a>
        </li>
      `).join('')}
    </ul>
    
    <button onclick="createNewStore()">+ Nueva Tienda</button>
  `;
  
  document.body.innerHTML = html;
}
```

---

## 🔧 Troubleshooting

### Error: "No o invalid Authorization header"

**Causa**: Falta el token Bearer

**Solución**:
```javascript
// ❌ Incorrecto
fetch('/api/provider/instances');

// ✅ Correcto
fetch('/api/provider/instances', {
  headers: {
    'Authorization': 'Bearer prov_xxxxx'
  }
});
```

### Error: "Invalid or expired token"

**Causa**: Token expirado o inválido

**Solución**:
```javascript
// Refrescar el token
const newToken = await sdk.refreshToken();
sdk.token = newToken.data.token;
```

### Error: "Instance limit reached"

**Causa**: Alcanzaste tu límite de instancias

**Solución**:
1. Elimina una instancia antigua
2. Contacta a soporte para upgrade

```javascript
// Listar y eliminar
const instances = await sdk.listInstances();
const oldest = instances.data.instances
  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

await sdk.deleteInstance(oldest.id);
```

### Error: "Email already registered"

**Causa**: Ya existe un provider con ese email

**Solución**:
1. Usa otro email
2. O haz login si ya eres ese provider

```javascript
// Usar email único
const email = `provider-${Date.now()}@company.com`;
await sdk.register(email, password, company, name);
```

---

## 📞 Soporte

Si tienes problemas:
- 📧 support@scalor.net
- 🐛 Issues: https://github.com/koumen222/ecomcookpit/issues
- 📖 Docs: https://docs.scalor.net/provider

---

**¡Comienza a integrar ahora! 🚀**
