const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
async function test() {
  const operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    source: { prompt: "test" }
  });
  console.log("has _fromAPIResponse?", typeof operation._fromAPIResponse);
  console.log("has name?", operation.name);
}
test();
