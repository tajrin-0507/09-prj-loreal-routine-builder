const ADVISOR_INSTRUCTIONS =
  "You are a friendly L'Oréal beauty advisor. Give practical, safe, personalized advice about skincare, haircare, makeup, fragrance, and related beauty topics. When building a routine, use only the products provided by the user and explain the order and when to use them. Do not invent product ingredients or make medical diagnoses. Keep follow-up answers relevant to the routine and beauty topics; politely redirect unrelated questions to beauty topics. Use web search for current or changing product information and include reliable, clickable sources in your answer. Prefer official brand and health sources.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getAssistantTextAndCitations(responseData) {
  const textParts = [];
  const citations = [];

  if (!responseData || !Array.isArray(responseData.output)) {
    return { text: "", citations: [] };
  }

  (responseData.output || []).forEach((item) => {
    if (item.type !== "message" || item.role !== "assistant") {
      return;
    }

    (item.content || []).forEach((content) => {
      if (content.type !== "output_text") {
        return;
      }

      textParts.push(content.text || "");
      (content.annotations || []).forEach((annotation) => {
        if (
          annotation.type === "url_citation" &&
          typeof annotation.url === "string"
        ) {
          citations.push({
            url: annotation.url,
            title:
              typeof annotation.title === "string" && annotation.title.trim()
                ? annotation.title
                : annotation.url,
            start_index: annotation.start_index,
            end_index: annotation.end_index,
          });
        }
      });
    });
  });

  const uniqueCitations = citations.filter(
    (citation, index, list) =>
      list.findIndex((item) => item.url === citation.url) === index
  );
  return { text: textParts.join("\n").trim(), citations: uniqueCitations };
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST to ask the beauty advisor." }, 405);
  }

  if (!env.OPENAI_API_KEY) {
    return jsonResponse(
      { error: "The Worker is missing its OPENAI_API_KEY secret." },
      500
    );
  }

  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (
    !requestData ||
    !Array.isArray(requestData.messages) ||
    requestData.messages.length === 0 ||
    requestData.messages.length > 40
  ) {
    return jsonResponse(
      { error: "Send between 1 and 40 conversation messages." },
      400
    );
  }

  const messages = requestData.messages;
  let totalCharacters = 0;
  for (const message of messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      return jsonResponse(
        { error: "Each message needs a supported role and text content." },
        400
      );
    }

    if (message.role === "system" && message !== messages[0]) {
      return jsonResponse(
        { error: "Only the first conversation message can be a system message." },
        400
      );
    }

    totalCharacters += message.content.length;
  }

  if (totalCharacters > 40000) {
    return jsonResponse(
      { error: "The conversation is too long. Start a new routine to continue." },
      400
    );
  }

  const input = [
    { role: "system", content: ADVISOR_INSTRUCTIONS },
    ...messages.filter((message) => message.role !== "system"),
  ];

  let openAIResponse;
  try {
    openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        tools: [{ type: "web_search" }],
        input,
        store: false,
        max_output_tokens: 1200,
      }),
    });
  } catch (error) {
    return jsonResponse(
      { error: "Could not connect to the AI service. Please try again." },
      502
    );
  }

  let responseData;
  try {
    responseData = await openAIResponse.json();
  } catch (error) {
    return jsonResponse(
      { error: "The AI service returned an unreadable response." },
      502
    );
  }

  if (!openAIResponse.ok) {
    return jsonResponse(
      { error: `The AI service request failed (HTTP ${openAIResponse.status}).` },
      502
    );
  }

  const result = getAssistantTextAndCitations(responseData);
  if (!result.text) {
    return jsonResponse(
      { error: "The AI service returned an empty response." },
      502
    );
  }

  return jsonResponse({
    choices: [{ message: { role: "assistant", content: result.text } }],
    citations: result.citations,
  });
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
