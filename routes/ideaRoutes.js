const express = require("express");
const router = express.Router();
const Idea = require("../models/Idea");

console.log("🔥 ideaRoutes.js LOADED");

// GET /api/v1/ideas - Fetch all submitted ideas
router.get("/", async (req, res) => {
    try {
        const ideas = await Idea.findAll({
            order: [["createdAt", "DESC"]]
        });
        res.json(ideas);
    } catch (error) {
        console.error("❌ Error fetching ideas:", error);
        res.status(500).json({ error: "Failed to fetch ideas" });
    }
});

module.exports = router;
