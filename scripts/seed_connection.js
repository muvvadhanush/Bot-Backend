const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');
const Connection = require('../models/Connection');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        // Create default connection
        const [connection, created] = await Connection.findOrCreate({
            where: { connectionId: 'cb_portal_v1' },
            defaults: {
                connectionId: 'cb_portal_v1',
                connectionSecret: 'default-secret-' + Math.random().toString(36).substring(7),
                assistantName: 'Portal Bot',
                welcomeMessage: 'Hello! How can I help you today?',
                websiteName: 'My Portal',
                websiteDescription: 'Default portal connection',
                tone: 'Friendly',
                theme: { primaryColor: '#007bff' }
            }
        });

        if (created) {
            console.log('🎉 Created default connection: cb_portal_v1');
        } else {
            console.log('ℹ️ Connection cb_portal_v1 already exists');
        }

    } catch (error) {
        console.error('❌ Seed failed:', error);
    } finally {
        await sequelize.close();
    }
}

seed();
