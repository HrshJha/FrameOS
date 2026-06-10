const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
async function test() {
  let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    source: { prompt: "test" }
  });
  console.log(`operation in template string: ${operation}`);
}
test();
