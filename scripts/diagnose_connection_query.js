const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '../debug_diagnosis.txt');

function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

// Clear log file
fs.writeFileSync(logFile, '');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');
const Connection = require('../models/Connection');
const ConnectionKnowledge = require('../models/ConnectionKnowledge');

// Replicate associations from app.js
Connection.hasMany(ConnectionKnowledge, { foreignKey: 'connectionId', sourceKey: 'connectionId' });
ConnectionKnowledge.belongsTo(Connection, { foreignKey: 'connectionId', targetKey: 'connectionId' });

async function diagnose() {
    try {
        log('Starting diagnosis...');
        await sequelize.authenticate();
        log('Database connected.');

        // List tables to verify names
        const [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        log('Tables in DB: ' + JSON.stringify(results.map(r => r.table_name)));

        const targetId = 'cb_portal_v1';
        log(`Searching for connectionId: ${targetId}`);

        // 1. Basic Find (No Include)
        const basic = await Connection.findOne({ where: { connectionId: targetId } });
        log('Basic FindOne Result: ' + (basic ? 'FOUND' : 'NOT FOUND'));

        // 2. Find with Include (The failing query)
        log('\nAttempting FindOne with Include...');
        try {
            const withInclude = await Connection.findOne({
                where: { connectionId: targetId },
                include: [{ model: ConnectionKnowledge }]
            });
            log('With Include Result: ' + (withInclude ? 'FOUND' : 'NOT FOUND'));
        } catch (err) {
            log('Error with Include: ' + err.message);
            // safe stringify
            try {
                log('Full Error JSON: ' + JSON.stringify(err, Object.getOwnPropertyNames(err)));
            } catch (e) {
                log('Could not stringify error');
            }
        }

    } catch (error) {
        log('Global Error: ' + error.message);
    } finally {
        await sequelize.close();
        log('Done.');
    }
}

diagnose();
