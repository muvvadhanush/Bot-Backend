const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');

async function enableRLS() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const tables = ['ChatSessions', 'Connections', 'Ideas', 'ConnectionKnowledges'];

        for (const table of tables) {
            try {
                // Enable RLS
                await sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
                console.log(`🔒 RLS Enabled for table: "${table}"`);

                // Create a policy for the service_role (backend) to bypass RLS explicitly, 
                // though admin/postgres usually bypasses it. 
                // Ideally, we create a policy that allows everything for the postgres user.
                // But "postgres" role usually has BYPASSRLS attribute. 
                // Let's just enable RLS to satisfy the linter.
            } catch (e) {
                console.warn(`⚠️ Could not enable RLS for "${table}":`, e.message);
            }
        }

    } catch (error) {
        console.error('❌ Failed:', error);
    } finally {
        await sequelize.close();
    }
}

enableRLS();
