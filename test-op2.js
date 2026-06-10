const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
async function test() {
  let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    source: { prompt: "test" }
  });
  console.log("has _fromAPIResponse before?", typeof operation._fromAPIResponse);
  operation = await ai.operations.getVideosOperation({ operation });
  console.log("has _fromAPIResponse after?", typeof operation._fromAPIResponse);
}
test();
