// CORS configuration
const allowedOrigins = [
    "https://ecomcookpit-production-7a08.up.railway.app",
    // other origins if any
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // New CORS check for wildcard support
    if (origin && origin.endsWith(".up.railway.app")) {
        return callback(null, true);
    }

    next();
});

// Existing code
