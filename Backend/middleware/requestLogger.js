// Middleware pour logger toutes les requêtes entrantes
const requestLogger = (req, res, next) => {
  const debugAuth = process.env.DEBUG_AUTH === 'true';
  
  if (debugAuth) {
    console.log(`📥 ${req.method} ${req.path}`, {
      origin: req.headers.origin,
      hasAuth: !!req.headers.authorization,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

module.exports = requestLogger;
