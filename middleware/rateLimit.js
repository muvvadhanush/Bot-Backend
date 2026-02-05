const rateLimitMap = new Map();

module.exports = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    const limit = 30; // 30 messages
    const windowMs = 60 * 1000; // per minute

    const record = rateLimitMap.get(ip) || { count: 0, time: now };

    if (now - record.time > windowMs) {
        record.count = 0;
        record.time = now;
    }

    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > limit) {
        return res.status(429).json({ error: "Too many messages. Slow down." });
    }

    next();
};
