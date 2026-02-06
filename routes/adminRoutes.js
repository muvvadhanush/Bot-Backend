const ChatSession = require("../models/ChatSession");
const connectionController = require("../controllers/connectionController");

// Existing Analytics Route
router.get("/analytics", async (req, res) => {
    // ...
});

// Knowledge Ingestion Route
router.post("/connections/:connectionId/knowledge/ingest", connectionController.ingestKnowledge);
router.post("/connections/:connectionId/branding/fetch", connectionController.fetchBranding);
router.get("/connections/:connectionId/details", connectionController.getConnectionDetails);

module.exports = router;
const sessions = await ChatSession.findAll();
res.json({
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((a, s) => a + s.messages.length, 0)
});
