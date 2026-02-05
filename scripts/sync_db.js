const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');

// Import models to ensure they are attached to Sequelize instance
const Connection = require('../models/Connection');
const ConnectionKnowledge = require('../models/ConnectionKnowledge');
const ChatSession = require('../models/ChatSession');
const Idea = require('../models/Idea');

// Replicate associations from app.js (important for ForeignKey constraints)
Connection.hasMany(ConnectionKnowledge, { foreignKey: 'connectionId', sourceKey: 'connectionId' });
ConnectionKnowledge.belongsTo(Connection, { foreignKey: 'connectionId', targetKey: 'connectionId' });

async function runSync() {
    try {
        console.log('Authenticating...');
        await sequelize.authenticate();
        console.log('Connected.');

        console.log('Syncing Database...');
        // Use alter: true to update tables if they exist but mismatch, or create if missing.
        // This is safer than force: true (drops data) and stronger than just sync()
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');

        // Verify table creation
        const [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'ConnectionKnowledges'
        `);

        if (results.length > 0) {
            console.log('SUCCESS: Table "ConnectionKnowledges" exists.');
        } else {
            console.error('FAILURE: Table "ConnectionKnowledges" still NOT found.');
        }

    } catch (error) {
        console.error('Sync failed:', error);
    } finally {
        await sequelize.close();
    }
}

runSync();
