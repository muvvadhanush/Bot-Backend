require("dotenv").config();
const sequelize = require("./config/db");

async function migrate() {
    try {
        console.log("🛠️ Starting manual migration...");

        await sequelize.query(`
            ALTER TABLE "Connections" 
            ADD COLUMN IF NOT EXISTS "behaviorProfile" JSONB DEFAULT '{}';
        `);
        console.log("✅ Added behaviorProfile column.");

        await sequelize.query(`
            ALTER TABLE "Connections" 
            ADD COLUMN IF NOT EXISTS "behaviorOverrides" JSONB DEFAULT '[]';
        `);
        console.log("✅ Added behaviorOverrides column.");

        console.log("🏁 Migration complete.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
