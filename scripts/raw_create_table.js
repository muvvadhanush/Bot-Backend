const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
    process.env.DB_NAME || process.env.database,
    process.env.DB_USER || process.env.user,
    process.env.DB_PASSWORD || process.env.password,
    {
        host: process.env.DB_HOST || process.env.db_host || "localhost",
        dialect: "postgres",
        port: process.env.DB_PORT || process.env.port || 5432,
        logging: console.log,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
);

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        console.log('--- TABLES BEFORE ---');
        const [tablesVal] = await sequelize.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public';
        `);
        console.log(tablesVal.map(t => t.tablename));

        console.log('--- CREATING TABLE "ConnectionKnowledges" ---');
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "ConnectionKnowledges" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "connectionId" VARCHAR(255) NOT NULL,
                "sourceType" VARCHAR(255) NOT NULL,
                "sourceValue" VARCHAR(255) NOT NULL,
                "rawText" TEXT,
                "cleanedText" TEXT,
                "status" VARCHAR(255) DEFAULT 'PENDING',
                "metadata" JSONB,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('Create command executed.');

        console.log('--- TABLES AFTER ---');
        const [tablesAfter] = await sequelize.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public';
        `);
        console.log(tablesAfter.map(t => t.tablename));

        // Enable RLS immediately just in case
        await sequelize.query(`ALTER TABLE "ConnectionKnowledges" ENABLE ROW LEVEL SECURITY;`);
        await sequelize.query(`
            DROP POLICY IF EXISTS "Deny Public Access" ON "ConnectionKnowledges";
        `);
        await sequelize.query(`
            CREATE POLICY "Deny Public Access" 
            ON "ConnectionKnowledges" 
            FOR ALL 
            TO anon, authenticated 
            USING (false);
        `);
        console.log('RLS secured.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

run();
