const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');
const Connection = require('../models/Connection');

async function dump() {
    try {
        const c = await Connection.findOne({ where: { connectionId: 'cb_portal_v1' } });
        console.log('--- CONNECTION DATA ---');
        console.log(JSON.stringify(c, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
dump();
