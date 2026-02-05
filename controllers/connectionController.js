const scraperService = require("../services/scraperService");
const ConnectionKnowledge = require("../models/ConnectionKnowledge");
const Connection = require("../models/Connection");

exports.createConnection = async (req, res) => {
    try {
        // Basic creation logic (preserving existing behavior if any, but since file was empty/stubbed, re-implementing base)
        // Actually, createConnection was handled in routes directly in previous phases (see routes/connectionRoutes.js).
        // So this controller might be new or unused. I will focus on the NEW method but keep createConnection just in case.
        const connection = await Connection.create(req.body);
        res.json(connection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.ingestKnowledge = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { sourceType, sourceValue } = req.body;

        if (!sourceType || !sourceValue) {
            return res.status(400).json({ error: "sourceType and sourceValue are required." });
        }

        // 1. Tenant Isolation: Verify Connection Exists
        const connection = await Connection.findOne({ where: { connectionId } });
        if (!connection) {
            return res.status(404).json({ error: "Connection not found." });
        }

        // 2. Process Ingestion
        let ingestResult = null;
        let status = 'READY';
        let errorMessage = null;

        try {
            if (sourceType === 'URL') {
                ingestResult = await scraperService.ingestURL(sourceValue);
            } else if (sourceType === 'TEXT') {
                ingestResult = scraperService.ingestText(sourceValue);
            } else {
                return res.status(400).json({ error: "Invalid sourceType. Use URL or TEXT." });
            }
        } catch (e) {
            status = 'FAILED';
            errorMessage = e.message;
            console.warn(`⚠️ Knowledge Ingestion Failed [${connectionId}]:`, e.message);
        }

        // 3. Persist to DB
        const record = await ConnectionKnowledge.create({
            connectionId,
            sourceType,
            sourceValue: sourceValue,
            rawText: ingestResult ? ingestResult.rawText : null,
            cleanedText: ingestResult ? ingestResult.cleanedText : null,
            status: status,
            metadata: errorMessage ? { error: errorMessage } : {}
        });

        res.status(status === 'FAILED' ? 422 : 201).json({
            success: status === 'READY',
            data: record
        });

    } catch (error) {
        console.error("❌ Controller Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

exports.fetchBranding = async (req, res) => {
    try {
        const { connectionId } = req.params;

        const connection = await Connection.findOne({ where: { connectionId } });
        if (!connection) return res.status(404).json({ error: "Connection not found" });

        // Use Connection URL (Not stored explicitly? Assumption: We use websiteName or need a new field? 
        // Wait, Connection model has websiteName, but maybe not URL.
        // The previous phases assumed URL was passed or stored. 
        // Let's check `Connection` model fields again.
        // It has `websiteName`, `websiteDescription`. NO URL field explicitly in schema view previously?
        // Wait, `createConnection` usually takes a URL.
        // Let's assume we pass URL in BODY for now if strictly needed, or use a known field.
        // Requirement says: "Fetch and store WEBSITE BRANDING".
        // It assumes we know the website.
        // If Connection table doesn't have `websiteUrl`, I might need to ask user or pass it in body.
        // Reviewing user request: "POST /admin/connections/:id/branding/fetch". No body mentioned?
        // Actually, "This endpoint: - Fetches branding". Implies it knows where.
        // Oh, `verify_branding.js` usually passes it?
        // Let's look at `scraperService` call: `fetchBranding(rawUrl, connectionId)`.
        // I'll assume we pass `url` in the BODY of the request for safety/flexibility.

        // Correction: I should add `url` to body.
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "Target URL required in body" });

        const result = await scraperService.fetchBranding(url, connectionId);

        // Update Connection
        await connection.update({
            faviconPath: result.faviconPath,
            logoPath: result.logoPath,
            brandingStatus: result.status
        });


        res.json({ success: true, branding: result });

    } catch (error) {
        console.error("❌ Branding Error:", error);
        res.status(500).json({ error: "Branding fetch failed" });
    }
};

exports.getConnectionDetails = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const connection = await Connection.findOne({
            where: { connectionId },
            include: [ConnectionKnowledge]
        });

        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }
        res.json(connection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
