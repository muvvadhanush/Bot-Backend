const ChatSession = require("../models/ChatSession");
const Connection = require("../models/Connection");
const Idea = require("../models/Idea");
const aiService = require("../services/aiservice");
const actionService = require("../services/actionService"); // Phase 5: Generic Actions

// Helper to send standardized response
const sendReply = (res, message, suggestions = [], aiMetadata = null) => {
  return res.status(200).json({
    messages: [{ role: "assistant", text: message }],
    suggestions,
    ai_metadata: aiMetadata
  });
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, connectionId, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: "Missing message or sessionId" });
    }

    // 1. Load or Create Session
    let session = await ChatSession.findOne({ where: { sessionId } });

    if (!session) {
      session = await ChatSession.create({
        sessionId,
        connectionId,
        messages: [],
        currentStep: 'NONE',
        tempData: {},
        mode: 'FREE_CHAT' // Default mode
      });
    }

    // Ensure session.tempData is an object
    let tempData = session.tempData || {};
    if (typeof tempData === 'string') {
      try { tempData = JSON.parse(tempData); } catch (e) { tempData = {}; }
    }

    // Ensure session.mode is valid (fallback)
    if (!session.mode) session.mode = 'FREE_CHAT';

    let response = { text: "", suggestions: [], ai_metadata: null };
    let nextStep = session.currentStep;

    console.log(`[${session.mode}] Step: ${session.currentStep} | Input: "${message}"`);

    // --- MODE SWITCHING LOGIC --- //

    // Check Trigger to ENTER Guided Flow
    if (session.mode === 'FREE_CHAT') {
      const lower = message.toLowerCase();
      if (lower.includes("submit idea") || lower.includes("new idea") || lower.includes("start submission")) {

        // --- PERMISSION CHECK: GUIDED FLOW ---
        const connectionObj = await Connection.findOne({ where: { connectionId } });
        const perms = connectionObj ? connectionObj.permissions : null;
        let allowedModes = ["FREE_CHAT"];

        // Handle JSON string vs Object
        let permsObj = perms;
        if (typeof perms === 'string') {
          try { permsObj = JSON.parse(perms); } catch (e) { permsObj = {}; }
        }

        if (permsObj && permsObj.modes) {
          allowedModes = permsObj.modes;
        }

        if (allowedModes.includes("GUIDED_FLOW")) {
          console.log("🔀 Switching to GUIDED_FLOW");
          session.mode = 'GUIDED_FLOW';
          session.currentStep = 'NONE'; // Reset step
          // Fall through to Guided Flow logic below
        } else {
          console.log("⛔ Access Denied: GUIDED_FLOW not allowed.");
          response.text = "I'm sorry, but Idea Submission is not enabled for this connection.";
          return sendReply(res, response.text);
        }

      } else {
        // STAY IN FREE CHAT
        let history = session.messages || [];
        if (typeof history === 'string') try { history = JSON.parse(history); } catch (e) { history = []; }

        // --- PERMISSION CHECK: AI ENABLED ---
        const connectionObj = await Connection.findOne({ where: { connectionId } });
        const perms = connectionObj ? connectionObj.permissions : null;

        let permsObj = perms;
        if (typeof perms === 'string') {
          try { permsObj = JSON.parse(perms); } catch (e) { permsObj = {}; }
        }

        let aiEnabled = true; // Default
        if (permsObj && typeof permsObj.aiEnabled !== 'undefined') {
          aiEnabled = permsObj.aiEnabled;
        }

        console.log(`[DEBUG] Connection: ${connectionId} | AI Enabled: ${aiEnabled} (Type: ${typeof aiEnabled})`);

        let aiReply = "I'm listening.";
        if (aiEnabled === true || aiEnabled === "true") {  // Handle boolean or string 'true'

          // --- PHASE 12: KNOWLEDGE RETRIEVAL (RAG-LITE) ---
          let knowledgeContext = "";
          try {
            // 1. Fetch Knowledge
            const knowledgeEntries = await ConnectionKnowledge.findAll({
              where: { connectionId, status: 'READY' }
            });

            if (knowledgeEntries.length > 0) {
              // 2. Keyword Scoring
              const userTokens = message.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);

              const scored = knowledgeEntries.map(k => {
                const text = (k.cleanedText || "").toLowerCase();
                let score = 0;
                userTokens.forEach(token => {
                  if (text.includes(token)) score += 1;
                });
                return { ...k.dataValues, score };
              });

              // 3. Sort & Filter
              scored.sort((a, b) => b.score - a.score);
              const topSnippets = scored.filter(s => s.score > 0).slice(0, 3);

              // 4. Construct Context
              if (topSnippets.length > 0) {
                knowledgeContext = topSnippets.map(s => `- ${s.cleanedText}`).join("\n\n");
                // Truncate safely
                if (knowledgeContext.length > 2000) knowledgeContext = knowledgeContext.substring(0, 2000) + "...";
                console.log(`📚 Injected ${topSnippets.length} snippets for chat.`);
              }
            }
          } catch (err) {
            console.error("Knowledge Retrieval Error:", err);
            // Fail gracefully, continue without context
          }

          aiReply = await aiService.freeChat({ message, history, context: knowledgeContext });
        } else {
          console.log("⛔ AI Chat Blocked.");
          aiReply = "AI Chat is disabled. Please type 'submit idea' to start a form (if allowed).";
        }

        response.text = aiReply;

        // Save history
        history.push({ role: "user", text: message });
        history.push({ role: "assistant", text: response.text });
        session.messages = history;
        session.changed('messages', true);
        await session.save();

        return sendReply(res, response.text);
      }
    }

    // Check Trigger to EXIT Guided Flow
    if (session.mode === 'GUIDED_FLOW') {
      const lower = message.toLowerCase();
      if (lower === "cancel" || lower === "exit" || lower === "stop") {
        console.log("🔀 Switching to FREE_CHAT (User Cancel)");
        session.mode = 'FREE_CHAT';
        session.currentStep = 'NONE';
        session.tempData = {};

        response.text = "Cancelled. You are back in free chat.";

        // Save transition
        session.currentStep = 'NONE';
        session.changed('tempData', true);
        await session.save();

        return sendReply(res, response.text);
      }
    }

    // --- STATE MACHINE (GUIDED_FLOW) --- //

    switch (session.currentStep) {
      case 'NONE':
        // Start Flow
        response.text = "Hi! Let's submit a new idea. What is the short TITLE of your idea?";
        nextStep = 'TITLE';
        break;

      case 'TITLE':
        // Validate Title
        if (message.length < 3 || /^\d+$/.test(message)) {
          response.text = "That title seems too short or invalid. Please provide a clear, short title (e.g. 'New Dashboard Widget').";
          // Stay on TITLE
        } else {
          tempData.title = message;

          // AI Suggestion (Non-blocking)
          const ai = await aiService.suggestTitles(message);
          response.ai_metadata = ai;

          response.text = `Got it: "${message}".\n\nNow, please describe the idea in detail (at least 10 characters).`;
          nextStep = 'DESCRIPTION';
        }
        break;

      case 'DESCRIPTION':
        // Validate Description
        if (message.length < 10) {
          response.text = "Please provide a bit more detail (at least 10 characters) so we can understand the idea.";
          // Stay on DESCRIPTION
        } else {
          // AI Enhancement & Prediction
          const aiEnhance = await aiService.enhanceDescription(message);
          const aiImpact = await aiService.predictImpact(message);

          tempData.description = message; // Save original user input
          response.ai_metadata = { ...aiEnhance, ...aiImpact };

          response.text = "Great description. Finally, roughly how many users will this impact? (e.g. '50', 'All users', 'Admin team')";
          response.suggestions = ["10-50", "100+", "All Users"];

          if (aiImpact.confidence !== 'low' && aiImpact.predicted_impact > 0) {
            response.suggestions.unshift(`${aiImpact.predicted_impact} (AI Est)`);
          }

          nextStep = 'IMPACT';
        }
        break;

      case 'IMPACT':
        // Validate Impact
        // Simple extraction: check for digits
        const match = message.match(/(\d+)/);
        const num = match ? parseInt(match[0], 10) : 0;

        if (num === 0 && !/\d/.test(message) && !message.toLowerCase().includes('all')) {
          // Let strict validation allow 'all' or actual numbers
          response.text = "I couldn't understand the number of users. Please type a number or estimate (e.g. '50').";
          response.suggestions = ["50", "100", "500"];
          // Stay on IMPACT
        } else {
          tempData.impactedUsers = num > 0 ? num : 0; // fallback to 0 if 'all' or text

          response.text = `Summary:\n- Title: ${tempData.title}\n- Desc: ${tempData.description}\n- Impact: ~${tempData.impactedUsers} users\n\nReady to submit?`;
          response.suggestions = ["Yes, Submit", "No, Restart"];
          nextStep = 'CONFIRM';
        }
        break;

      case 'CONFIRM':
        const lower = message.toLowerCase();
        if (lower.includes("yes") || lower.includes("submit") || lower.includes("confirm")) {
          // --- GENERIC ACTION DISPATCH --- (Phase 5)
          const connectionObj = await Connection.findOne({ where: { connectionId } });

          // Use Connection config OR Default to SAVE (Backward Compatibility)
          const actionConfig = (connectionObj && connectionObj.actionConfig)
            ? connectionObj.actionConfig
            : { type: "SAVE", config: { target: "ideas_table" } };

          // Permission Check for Actions happening in actionService, but we pass permissions explicitly here
          const result = await actionService.executeAction(actionConfig, payload, connectionObj ? connectionObj.permissions : null);

          // Result might contain specific data (like Idea ID) if it was a SAVE action
          const refText = result.data && result.data.ideaId ? ` Reference ID: ${result.data.ideaId}.` : "";

          response.text = `✅ ${result.message}${refText}\n\nReturning to free chat.`;

          // EXIT GUIDED FLOW ON SUCCESS
          nextStep = 'SUBMITTED';
          session.mode = 'FREE_CHAT';

        } else if (lower.includes("no") || lower.includes("restart")) {
          // Reset
          tempData = {};
          response.text = "Cancelled. Let's start over. What is the title?";
          nextStep = 'TITLE';
        } else {
          response.text = "Please type 'Yes' to submit or 'No' to cancel.";
          response.suggestions = ["Yes, Submit", "No, Cancel"];
          // Stay on CONFIRM
        }
        break;

      case 'SUBMITTED':
        // Should not really happen if we switch mode, but safe recovery
        session.mode = 'FREE_CHAT';
        tempData = {};
        response.text = "You are back in free chat. Type 'submit idea' to start again.";
        nextStep = 'NONE';
        break;

      default:
        // Recovery
        nextStep = 'NONE';
        response.text = "System reset. Type 'submit idea' to start.";
        break;
    }

    // 3. Save State (Guided Flow)
    session.currentStep = nextStep;
    session.tempData = { ...tempData };
    session.changed('tempData', true);

    // Save Message History (Optional, for audit)
    let msgs = session.messages || [];
    if (typeof msgs === 'string') try { msgs = JSON.parse(msgs); } catch (e) { msgs = []; }

    msgs.push({ role: "user", text: message });
    msgs.push({ role: "assistant", text: response.text });
    session.messages = msgs;
    session.changed('messages', true);

    await session.save();

    // 4. Send Reply
    return sendReply(res, response.text, response.suggestions || [], response.ai_metadata);

  } catch (error) {
    console.error("❌ State Machine Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
