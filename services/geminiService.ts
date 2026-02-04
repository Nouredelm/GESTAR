
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSpatialInsight = async (fileName: string, fileType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `The user has uploaded a ${fileType} named "${fileName}". Provide a very brief, professional 2-sentence spatial analysis or interesting fact about this kind of object for a mixed reality experience.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini insight error:", error);
    return "Ready for spatial manipulation.";
  }
};
