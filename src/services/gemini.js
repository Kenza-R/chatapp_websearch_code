import { GoogleGenerativeAI } from '@google/generative-ai';
import { CSV_TOOL_DECLARATIONS } from './csvTools';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || '');

const MODEL = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.5-flash-lite';

const SEARCH_TOOL = { googleSearch: {} };
const CODE_EXEC_TOOL = { codeExecution: {} };

export const CODE_KEYWORDS = /\b(plot|chart|graph|analyz|statistic|regression|correlat|histogram|visualiz|calculat|compute|run code|write code|execute|pandas|numpy|matplotlib|csv|data)\b/i;

let cachedPrompt = null;

async function loadSystemPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const res = await fetch('/prompt_chat.txt');
    cachedPrompt = res.ok ? (await res.text()).trim() : '';
  } catch {
    cachedPrompt = '';
  }
  return cachedPrompt;
}

// Yields:
//   { type: 'text', text }           — streaming text chunks
//   { type: 'fullResponse', parts }  — when code was executed; replaces streamed text
//   { type: 'grounding', data }      — Google Search metadata
//
// fullResponse parts: { type: 'text'|'code'|'result'|'image', ... }
//
// useCodeExecution: pass true to use codeExecution tool (CSV/analysis),
//                   false (default) to use googleSearch tool.
// Note: Gemini does not support both tools simultaneously.
export const streamChat = async function* (history, newMessage, imageParts = [], useCodeExecution = false) {
  const systemInstruction = await loadSystemPrompt();
  const tools = useCodeExecution ? [CODE_EXEC_TOOL] : [SEARCH_TOOL];
  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools,
  });

  const baseHistory = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content || '' }],
  }));

  const chatHistory = systemInstruction
    ? [
        {
          role: 'user',
          parts: [{ text: `Follow these instructions in every response:\n\n${systemInstruction}` }],
        },
        { role: 'model', parts: [{ text: "Got it! I'll follow those instructions." }] },
        ...baseHistory,
      ]
    : baseHistory;

  const chat = model.startChat({ history: chatHistory });

  const parts = [
    { text: newMessage },
    ...imageParts.map((img) => ({
      inlineData: { mimeType: img.mimeType || 'image/png', data: img.data },
    })),
  ].filter((p) => p.text !== undefined || p.inlineData !== undefined);

  const result = await chat.sendMessageStream(parts);

  // Stream text chunks for live display
  for await (const chunk of result.stream) {
    const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
    for (const part of chunkParts) {
      if (part.text) yield { type: 'text', text: part.text };
    }
  }

  // After stream: inspect all response parts
  const response = await result.response;
  const allParts = response.candidates?.[0]?.content?.parts || [];

  const hasCodeExecution = allParts.some(
    (p) =>
      p.executableCode ||
      p.codeExecutionResult ||
      (p.inlineData && p.inlineData.mimeType?.startsWith('image/'))
  );

  if (hasCodeExecution) {
    // Build ordered structured parts to replace the streamed text
    const structuredParts = allParts
      .map((p) => {
        if (p.text) return { type: 'text', text: p.text };
        if (p.executableCode)
          return {
            type: 'code',
            language: p.executableCode.language || 'PYTHON',
            code: p.executableCode.code,
          };
        if (p.codeExecutionResult)
          return {
            type: 'result',
            outcome: p.codeExecutionResult.outcome,
            output: p.codeExecutionResult.output,
          };
        if (p.inlineData)
          return { type: 'image', mimeType: p.inlineData.mimeType, data: p.inlineData.data };
        return null;
      })
      .filter(Boolean);

    yield { type: 'fullResponse', parts: structuredParts };
  }

  // Grounding metadata (search sources)
  const grounding = response.candidates?.[0]?.groundingMetadata;
  if (grounding) {
    console.log('[Search grounding]', grounding);
    yield { type: 'grounding', data: grounding };
  }
};

// ── Function-calling chat for CSV tools ───────────────────────────────────────
// Gemini picks a tool + args → executeFn runs it client-side (free) → Gemini
// receives the result and returns a natural-language answer.
//
// executeFn(toolName, args) → plain JS object with the result (may be a Promise)
// options.toolDeclarations: optional array to merge with or replace CSV tools (e.g. YouTube JSON tools)
// Returns the final text response from the model.

export const chatWithCsvTools = async (history, newMessage, csvHeaders, executeFn, options = {}) => {
  const systemInstruction = await loadSystemPrompt();
  const toolDeclarations = options.toolDeclarations || CSV_TOOL_DECLARATIONS;
  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools: [{ functionDeclarations: toolDeclarations }],
  });

  const baseHistory = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content || '' }],
  }));

  const chatHistory = systemInstruction
    ? [
        {
          role: 'user',
          parts: [{ text: `Follow these instructions in every response:\n\n${systemInstruction}` }],
        },
        { role: 'model', parts: [{ text: "Got it! I'll follow those instructions." }] },
        ...baseHistory,
      ]
    : baseHistory;

  const chat = model.startChat({ history: chatHistory });

  // Include column names and/or JSON context so the model can match user intent
  const msgWithContext = csvHeaders?.length
    ? `[CSV columns: ${csvHeaders.join(', ')}]\n\n${newMessage}`
    : newMessage;

  let response = (await chat.sendMessage(msgWithContext)).response;

  // Accumulate chart payloads and a log of every tool call made
  const charts = [];
  const toolCalls = [];

  // Function-calling loop (Gemini may chain multiple tool calls)
  for (let round = 0; round < 5; round++) {
    const parts = response.candidates?.[0]?.content?.parts || [];
    const funcCall = parts.find((p) => p.functionCall);
    if (!funcCall) break;

    const { name, args } = funcCall.functionCall;
    console.log('[CSV Tool]', name, args);
    const toolResult = await Promise.resolve(executeFn(name, args));
    console.log('[CSV Tool result]', toolResult);

    // Log the call for persistence
    toolCalls.push({ name, args, result: toolResult });

    // Capture chart payloads, video cards, and generated images for UI
    if (toolResult?._chartType || toolResult?._cardType || toolResult?.imageBase64 || (name === 'generateImage' && (toolResult?.fallback || toolResult?.imageBase64))) {
      charts.push(toolResult);
    }

    // Send a sanitized result to the model — never include base64 image data or huge payloads
    let resultForModel = toolResult;
    if (name === 'generateImage' && (toolResult?.imageBase64 || toolResult?.fallback)) {
      resultForModel = toolResult.fallback
        ? { success: false, fallback: true, note: toolResult.error || 'Image generation failed (API quota or model limit). Tell the user image generation is currently unavailable.' }
        : { success: true, note: 'Image generated and displayed to the user.' };
    } else if (toolResult?.imageBase64 && !toolResult?.error) {
      resultForModel = { ...toolResult, imageBase64: undefined, note: 'Image generated.' };
    }

    response = (
      await chat.sendMessage([
        { functionResponse: { name, response: { result: resultForModel } } },
      ])
    ).response;
  }

  return { text: response.text(), charts, toolCalls };
};
