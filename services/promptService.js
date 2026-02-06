const Connection = require("../models/Connection");

/**
 * The Brain Stem of the Behavior Engine.
 * Follows a strict order of assembly:
 * 1. System Rules
 * 2. Website Behavior
 * 3. Page Overrides
 * 4. RAG Memory
 * 5. User Message (Passed to AI)
 */
exports.assemblePrompt = async (connectionId, pageUrl, context) => {
    try {
        const connection = await Connection.findOne({ where: { connectionId } });
        if (!connection) return "You are a helpful assistant.";

        const profile = connection.behaviorProfile || {};
        const overrides = connection.behaviorOverrides || [];

        // 1. System Rules (Hardcoded Hard Constraints)
        let prompt = "## SYSTEM RULES\n- You are a deterministic assistant.\n- Do not invent facts outside the provided knowledge.\n- Follow the behavior profile strictly.\n";

        // 2. Website Behavior (Global)
        prompt += `\n## BEHAVIOR PROFILE (GLOBAL)
- ROLE: ${profile.assistantRole || 'assistant'}
- TONE: ${profile.tone || 'neutral'}
- RESPONSE LENGTH: ${profile.responseLength || 'medium'}
- SALES INTENSITY: ${profile.salesIntensity || 0.0} (0.0=none, 1.0=aggressive)
- EMPATHY LEVEL: ${profile.empathyLevel || 0.5}
- PRIMARY GOAL: ${profile.primaryGoal || 'support'}
`;

        if (profile.hardConstraints?.never_claim?.length > 0) {
            prompt += `- NEVER CLAIM: ${profile.hardConstraints.never_claim.join(", ")}\n`;
        }
        if (profile.hardConstraints?.escalation_path) {
            prompt += `- ESCALATION PATH: ${profile.hardConstraints.escalation_path}\n`;
        }

        // 3. Page Overrides (Matched)
        if (pageUrl && overrides.length > 0) {
            const path = new URL(pageUrl).pathname;
            const match = overrides.find(o => path.includes(o.match));

            if (match) {
                prompt += `\n## PAGE-LEVEL OVERRIDES (CONTEXT: ${path})
- APPLY THESE RULES WITH HIGHEST PRIORITY:
`;
                Object.entries(match.overrides || {}).forEach(([key, val]) => {
                    prompt += `- ${key.toUpperCase()}: ${val}\n`;
                });
                if (match.instruction) {
                    prompt += `- SPECIAL INSTRUCTION: ${match.instruction}\n`;
                }
            }
        }

        // 4. RAG Memory (Read Only)
        if (context) {
            prompt += `\n## KNOWLEDGE BASE (CONTEXT)
Use ONLY the information below to answer. If it's not here, follow your primary goal or escalation path.
---
${context}
---
`;
        }

        console.log(`🧠 [DEBUG] ASSEMBLED PROMPT for ${connectionId} (${pageUrl}):\n${prompt}`);

        return prompt;
    } catch (err) {
        console.error("Prompt Assembly Error:", err);
        return "You are a helpful assistant.";
    }
};
