import { GoogleGenAI } from "@google/genai";
import { Faction, GameState } from '../types';

const getAiClient = () => {
  if (!process.env.API_KEY) {
    console.warn("No API Key found for Gemini.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateYearlyReport = async (state: GameState): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "The historians are silent... (Check API Key)";

  const year = Math.floor(state.day / 365) + 218; // Start year 218 BC roughly
  const currentYearBC = 264 - Math.floor(state.day / 300); // Rough simulation of BC years counting down
  
  const prompt = `
    You are a Roman or Carthaginian historian. The year is roughly ${currentYearBC} BC.
    
    Current situation:
    - Roman Treasury: ${state.resources[Faction.ROME]} gold
    - Carthaginian Treasury: ${state.resources[Faction.CARTHAGE]} gold
    - Roman Provinces: ${Object.values(state.nodes).filter(n => n.owner === Faction.ROME).map(n => n.name).join(', ')}
    - Carthaginian Provinces: ${Object.values(state.nodes).filter(n => n.owner === Faction.CARTHAGE).map(n => n.name).join(', ')}
    
    Winter has just passed. Spring campaigning season begins.
    Write a short, dramatic paragraph (max 50 words) summarizing the strategic situation for the ${state.playerFaction === Faction.ROME ? 'Roman Senate' : 'Council of Carthage'}.
    Adopt a serious, archaic tone.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "The winds of war shift...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Messengers were lost in the mountains...";
  }
};

export const generateBattleReport = async (location: string, winner: Faction, loser: Faction): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return `Battle at ${location}: ${winner} victorious.`;

  const prompt = `
    A battle has occurred at ${location} between ${winner} and ${loser}.
    ${winner} was victorious.
    Write a very brief, visceral 1-sentence description of the battle's outcome (e.g., "Ships burned...", "Shields shattered...").
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || `${winner} claims victory at ${location}.`;
  } catch (error) {
    return `${winner} defeated ${loser} at ${location}.`;
  }
};