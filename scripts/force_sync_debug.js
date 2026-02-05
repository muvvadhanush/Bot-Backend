const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');

// Import models
const Connection = require('../models/Connection');
const ConnectionKnowledge = require('../models/ConnectionKnowledge');

// Associations
Connection.hasMany(ConnectionKnowledge, { foreignKey: 'connectionId', sourceKey: 'connectionId' });
ConnectionKnowledge.belongsTo(Connection, { foreignKey: 'connectionId', targetKey: 'connectionId' });

async function debugSync() {
    try {
        console.log('Authenticating...');
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. List Tables BEFORE
        let [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables BEFORE:', results.map(r => r.table_name));

        // 2. Sync
        console.log('Running sync({ alter: true })...');
        await sequelize.sync({ alter: true });
        console.log('Sync finished.');

        // 3. List Tables AFTER
        [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables AFTER:', results.map(r => r.table_name));

        // 4. Force Create if missing
        if (!results.find(r => r.table_name === 'ConnectionKnowledges' || r.table_name === 'ConnectionKnowledge')) {
            console.log('Table still missing. Attempting RAW CREATE...');
            // Minimal schema, assuming Sequelize will fix columns later or we define what we need.
            // Copied from ConnectionKnowledge.js logic
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS "ConnectionKnowledges" (
                    "id" UUID PRIMARY KEY,
                    "connectionId" VARCHAR(255) NOT NULL,
                    "sourceType" VARCHAR(255) NOT NULL,
                    "sourceValue" VARCHAR(255) NOT NULL,
                    "rawText" TEXT,
                    "cleanedText" TEXT,
                    "status" VARCHAR(255) DEFAULT 'PENDING',
                    "metadata" JSON,
                    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `);
            console.log('Raw CREATE finished.');
        }

    } catch (error) {
        console.error('Debug Sync Failed:', error);
    } finally {
        await sequelize.close();
    }
}

debugSync();
