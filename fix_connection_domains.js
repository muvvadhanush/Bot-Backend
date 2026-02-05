require('dotenv').config();
const db = require('./config/db');
const Connection = require('./models/Connection');

(async () => {
    try {
        await db.authenticate();
        const conn = await Connection.findOne({ where: { connectionId: 'ideaflow_ui_v1' } });
        if (conn) {
            console.log("Current Allowed Domains:", conn.allowedDomains);
            conn.allowedDomains = ["*"]; // Allow all
            await conn.save();
            console.log("✅ Updated allowedDomains to ['*']");
        } else {
            console.log("❌ Connection not found");
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
