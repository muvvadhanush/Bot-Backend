const crypto = require("crypto");
const Idea = require("../models/Idea");
const sequelize = require("../config/db");

/**
 * Service to handle ATOMIC and IDEMPOTENT idea submissions.
 */
class IdeaService {

    /**
     * Submit an idea with guaranteed idempotency.
     * @param {object} payload 
     * @param {string} payload.title
     * @param {string} payload.description
     * @param {number} payload.impactedUsers
     * @param {string} payload.connectionId
     * @param {string} payload.sessionId
     */
    async submitIdea({ title, description, impactedUsers, connectionId, sessionId }) {
        // 1. Generate Deterministic Idempotency Key
        // Key = SessionID + Title + Description + Impact
        const rawKey = `${sessionId}|${title}|${description}|${impactedUsers}`;
        const idempotencyKey = crypto.createHash("sha256").update(rawKey).digest("hex");

        console.log(`🔒 Processing key: ${idempotencyKey.substring(0, 10)}`);

        // 2. Atomic Transaction
        const transaction = await sequelize.transaction();
        console.log("🔒 Transaction Started");

        try {
            // 3. Check for Duplicate (Idempotency)
            const existing = await Idea.findOne({
                where: { idempotencyKey },
                transaction
            });

            if (existing) {
                console.log("⚠️ Duplicate (Existing):", existing.ideaId);
                await transaction.commit();
                return {
                    source: "EXISTING",
                    ideaId: existing.ideaId,
                    title: existing.title
                };
            }

            console.log("✨ Creating new idea record...");
            // 4. Create New Record
            const ideaId = `idea_${Date.now()}`;

            const newIdea = await Idea.create({
                ideaId,
                connectionId,
                title,
                description,
                impactedUsers,
                idempotencyKey,
                source: "CHATBOT",
                status: "New"
            }, { transaction });

            console.log("✅ New Idea Persisted:", ideaId);
            await transaction.commit();

            return {
                source: "NEW",
                ideaId: newIdea.ideaId,
                title: newIdea.title
            };

        } catch (error) {
            await transaction.rollback();

            if (error.name === 'SequelizeUniqueConstraintError') {
                console.log("⚠️ Race Condition Caught: Unique Constraint. Returning existing.");
                // We need to fetch the ideaId again or just return "Verified" (since we can't get the ID easily without another query)
                // But strictly, we should return the ID.
                // Let's do a quick lookup
                const existingRace = await Idea.findOne({ where: { idempotencyKey } });
                return {
                    source: "EXISTING",
                    ideaId: existingRace ? existingRace.ideaId : "UNKNOWN",
                    title: title
                };
            }

            console.error("❌ Submission Transaction Failed:", error.message);
            // Log stack trace if possible
            console.error(error.stack);
            throw error;
        }
    }
}

module.exports = new IdeaService();

