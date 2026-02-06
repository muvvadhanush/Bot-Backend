const dns = require('dns');
// Force IPv4 to avoid ENOTFOUND on some Windows/Node setups with Supabase
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // ignore
}

process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED REJECTION:", reason);
});

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const sequelize = require("./config/db");
const chatRoutes = require("./routes/chatRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const Idea = require("./models/Idea");
const Connection = require("./models/Connection");
const ConnectionKnowledge = require("./models/ConnectionKnowledge");

// Associations
Connection.hasMany(ConnectionKnowledge, { foreignKey: 'connectionId', sourceKey: 'connectionId' });
ConnectionKnowledge.belongsTo(Connection, { foreignKey: 'connectionId', targetKey: 'connectionId' });

const app = express();

// CORS - Allow all origins with explicit headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('X-Content-Type-Options', 'nosniff');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// 👇 ERROR HANDLER FOR JSON PARSING
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error("🔥 JSON SYNTX ERROR in body:", err.message);
    console.error("🔥 FAILED BODY:", req.body); // Might be partially parsed or string
    return res.status(400).send({ error: "Malformed JSON body" });
  }
  next();
});

// Serve static files (widget)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "chatbot-backend",
    timestamp: new Date().toISOString(),
  });
});

// ROUTES
app.use("/api/chat", chatRoutes);
app.use("/api/connections", connectionRoutes);
console.log("🔄 Mounting /api/v1/ideas...");
app.use("/api/v1/ideas", require("./routes/ideaRoutes"));

// ADMIN PANEL (Protected)
const basicAuth = require("./middleware/auth");
app.get("/admin", basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

// DATABASE SYNC & SERVER START
const PORT = process.env.PORT || 5000;

sequelize.sync()
  .then(() => {
    console.log("📦 Database synced successfully");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API endpoints:`);
      console.log(`   POST /api/chat/send`);
      console.log(`   GET  /api/chat/welcome/:connectionId`);
      console.log(`   POST /api/connections/create`);
    });
  })
  .catch((err) => {
    console.error("❌ Database sync failed:", err);
    process.exit(1); // fail fast in production
  });

// KEEP PROCESS ALIVE (Windows safety)
setInterval(() => { }, 1000);
