const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/db');

async function checkRLS() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('ChatSessions', 'Connections', 'Ideas', 'ConnectionKnowledges')
      AND relkind = 'r';
    `);
        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}
checkRLS();
