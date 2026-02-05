
require('dotenv').config();
const sequelize = require('./config/db');
const Connection = require('./models/Connection');

async function seed() {
    try {
        await sequelize.sync();

        // Check if connection already exists
        const existing = await Connection.findOne({ where: { connectionId: 'cb_portal_v1' } });
        if (existing) {
            console.log('Connection "cb_portal_v1" already exists.');
            return;
        }

        await Connection.create({
            connectionId: "cb_portal_v1",
            connectionSecret: "secret123",
            websiteName: "Demo Shop",
            websiteDescription: "A demo electronics shop",
            assistantName: "ShopBot",
            tone: "friendly",
            allowedDomains: ["*"], // Allow all for demo
            systemPrompt: "You are a helpful assistant for a demo shop.",
            knowledgeBase: "We sell refined AI coding assistants.",
            welcomeMessage: "Hello! checking files and running program... done!",
        });

        console.log('Seed data inserted successfully.');
    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        await sequelize.close();
    }
}

seed();
