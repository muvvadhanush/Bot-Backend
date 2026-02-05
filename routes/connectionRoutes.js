const express = require("express");
const router = express.Router();
const Connection = require("../models/Connection");
const scraperService = require("../services/scraperService");

// Create a new connection
router.post("/create", async (req, res) => {
  try {
    const connection = await Connection.create(req.body);
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scrape website and extract knowledge base
router.post("/scrape", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("📡 Scrape request for:", url);

    const result = await scraperService.scrapeWebsite(url);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      metadata: result.metadata,
      knowledgeBase: result.knowledgeBase,
      suggestedBotName: result.suggestedBotName,
      suggestedWelcome: result.suggestedWelcome,
      suggestedTone: result.suggestedTone,
      preview: result.rawText.substring(0, 500)
    });

  } catch (error) {
    console.error("❌ Scrape route error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-extract knowledge base from host website
router.post("/auto-extract", async (req, res) => {
  try {
    const { connectionId, hostUrl } = req.body;

    if (!connectionId || !hostUrl) {
      return res.status(400).json({ error: "connectionId and hostUrl are required" });
    }

    console.log(`🔍 Auto-extract for connection: ${connectionId}, URL: ${hostUrl}`);

    // Find the connection
    const connection = await Connection.findOne({
      where: { connectionId }
    });

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Check if knowledge base already exists and is not empty/default
    if (connection.knowledgeBase && connection.knowledgeBase.length > 50) {
      console.log(`✅ Knowledge base already exists for ${connectionId}, skipping extraction`);
      return res.json({
        success: true,
        message: "Knowledge base already exists",
        alreadyExtracted: true
      });
    }

    // Scrape the host website
    console.log(`🌐 Scraping host website: ${hostUrl}`);
    const result = await scraperService.scrapeWebsite(hostUrl);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Update the connection with extracted data
    await connection.update({
      knowledgeBase: result.knowledgeBase,
      assistantName: result.suggestedBotName || connection.assistantName,
      welcomeMessage: result.suggestedWelcome || connection.welcomeMessage,
      tone: result.suggestedTone || connection.tone,
      websiteName: result.metadata.title || connection.websiteName,
      websiteDescription: result.metadata.description || connection.websiteDescription,
      logoUrl: result.logoUrl || connection.logoUrl,
      extractedTools: result.extractedTools || []
    });

    console.log(`✅ Knowledge base extracted and saved for ${connectionId}`);

    res.json({
      success: true,
      message: "Knowledge base extracted successfully",
      botName: result.suggestedBotName,
      welcomeMessage: result.suggestedWelcome,
      knowledgeBasePreview: result.knowledgeBase.substring(0, 200)
    });

  } catch (error) {
    console.error("❌ Auto-extract error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all connections
router.get("/list", async (req, res) => {
  try {
    const connections = await Connection.findAll({
      attributes: ["id", "connectionId", "websiteName", "assistantName", "createdAt", "logoUrl"]
    });
    res.json(connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single connection
router.get("/:connectionId", async (req, res) => {
  try {
    const connection = await Connection.findOne({
      where: { connectionId: req.params.connectionId }
    });
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update connection
router.put("/:connectionId", async (req, res) => {
  try {
    const connection = await Connection.findOne({
      where: { connectionId: req.params.connectionId }
    });
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    await connection.update(req.body);
    res.json(connection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete connection
router.delete("/:connectionId", async (req, res) => {
  try {
    const connection = await Connection.findOne({
      where: { connectionId: req.params.connectionId }
    });
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    await connection.destroy();
    res.json({ success: true, message: "Connection deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
