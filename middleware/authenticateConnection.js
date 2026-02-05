const Connection = require("../models/Connection");

module.exports = async (req, res, next) => {
    const { connectionId, connectionSecret } = req.body;

    // domain from browser
    const origin =
        req.headers.origin ||
        req.headers.referer ||
        "unknown";

    if (!connectionId || !connectionSecret) {
        return res.status(401).json({
            error: "Chatbot connection credentials missing"
        });
    }

    const connection = await Connection.findOne({
        where: { connectionId, connectionSecret }
    });

    if (!connection) {
        return res.status(401).json({
            error: "Invalid chatbot credentials"
        });
    }

    // Domain allow-list check
    if (
        connection.allowedDomains &&
        !connection.allowedDomains.includes(origin)
    ) {
        return res.status(403).json({
            error: "This domain is not allowed to use the chatbot"
        });
    }

    // Attach connection to request
    req.connection = connection;
    next();
};
