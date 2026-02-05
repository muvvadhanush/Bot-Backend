const basicAuth = (req, res, next) => {
    // Simple hardcoded credentials for now
    // In production, these should be in environment variables
    const user = process.env.ADMIN_USER || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, pwd] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && pwd && login === user && pwd === password) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
    res.status(401).send('Authentication required.');
};

module.exports = basicAuth;
