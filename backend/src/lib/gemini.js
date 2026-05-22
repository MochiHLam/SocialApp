import { GoogleGenerativeAI } from "@google/generative-ai";

import { AppError } from "../utils/app-error.js";

function getModel(system) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("AI is not configured on the server", 500);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: system,
  });
}

export async function generateGeminiJson({ system, user }) {
  try {
    const model = getModel(system);
    const result = await model.generateContent(user);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch (_parseError) {
      console.error("Gemini returned non-JSON:", text);
      throw new AppError("AI returned invalid JSON", 500);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Gemini request failed:", error);
    throw new AppError("AI request failed", 500);
  }
}
