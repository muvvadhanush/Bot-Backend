const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ [aiservice] OPENAI_API_KEY is missing!");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key"
});

/**
 * PURE UTILITY AI SERVICE - SUGGESTION ENGINE
 * No conversational logic. No state management.
 * Returns strict JSON metadata.
 */

exports.suggestTitles = async (text) => {
  try {
    if (!text || text.length < 3) return { suggestions: [] };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Output JSON only. Key: 'suggestions' (array of strings)." },
        { role: "user", content: `Suggest 3 professional titles for: "${text}"` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0.7
    });

    const data = JSON.parse(response.choices[0].message.content);
    return { suggestions: data.suggestions || [] };
  } catch (err) {
    console.error("AI Title Error:", err.message);
    return { suggestions: [] };
  }
};

exports.enhanceDescription = async (text) => {
  try {
    if (!text || text.length < 10) return { enhanced_description: text, suggestions: [] };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Output JSON only. Keys: 'enhanced_description' (string), 'suggestions' (array of strings)." },
        { role: "user", content: `Improve this description and list 2 short suggestions to add detail:\n"${text}"` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.7
    });

    const data = JSON.parse(response.choices[0].message.content);
    return {
      enhanced_description: data.enhanced_description || text,
      suggestions: data.suggestions || []
    };
  } catch (err) {
    console.error("AI Enhance Error:", err.message);
    return { enhanced_description: text, suggestions: [] };
  }
};

exports.predictImpact = async (description) => {
  try {
    if (!description || description.length < 10) return { predicted_impact: 0, confidence: "low" };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Output JSON only. Keys: 'predicted_impact' (integer), 'confidence' (low/medium/high)." },
        { role: "user", content: `Estimate user impact count for: "${description}"` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
      temperature: 0.5
    });

    const data = JSON.parse(response.choices[0].message.content);
    return {
      predicted_impact: typeof data.predicted_impact === 'number' ? data.predicted_impact : 0,
      confidence: data.confidence || "low"
    };
  } catch (err) {
    console.error("AI Impact Error:", err.message);
    return { predicted_impact: 0, confidence: "low" };
  }
};

exports.freeChat = async ({ message, history, context, systemPrompt: customPrompt }) => {
  try {
    let systemPrompt = customPrompt || "You are a helpful assistant. If the user asks to submit an idea, tell them to type 'submit idea' to start the process. Keep responses short and friendly.";

    // Legacy context injection fallback (if customPrompt not provided)
    if (!customPrompt && context) {
      systemPrompt = `You are a helpful assistant for a specific website. 
Answer questions ONLY using the provided knowledge below. 
If the answer is NOT in the knowledge, say you don't know and offer to help with something else. 
Do NOT invent facts. 

Relevant Knowledge:
${context}

If the user asks to submit an idea, tell them to type 'submit idea'.`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-5).map(m => ({ role: m.role, content: m.text })),
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    return reply || "I'm listening.";

  } catch (err) {
    console.error("AI Free Chat Error:", err.message);
    return "I'm having a bit of trouble connecting right now. Please try again.";
  }
};

/**
 * Phase 5/7: Extract structured data from user messages for the state machine.
 */
exports.extractImpact = async (text) => {
  try {
    if (!text || text.length < 2) return { impact: null };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Output JSON only. Key: 'impact' (string or null). Summarize the user's stated impact/goal in 5-10 words." },
        { role: "user", content: `Extract impact from: "${text}"` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 100
    });

    const data = JSON.parse(response.choices[0].message.content);
    return { impact: data.impact || null };
  } catch (err) {
    console.error("AI extractImpact Error:", err.message);
    return { impact: null };
  }
};

/**
 * Phase 11: Auto-Extract Identity.
 * Infers name, tone, and summary from homepage text.
 */
exports.inferBotIdentity = async (text) => {
  try {
    if (!text || text.length < 10) return null;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Output JSON only. Keys: 'bot_name' (max 2 words), 'welcome_message' (1 sentence), 'tone' (formal|friendly|neutral), 'site_summary' (2-3 sentences)."
        },
        { role: "user", content: `Infer bot identity from this website content:\n\n${text.substring(0, 3000)}` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("AI inferBotIdentity Error:", err.message);
    return null;
  }
};
