const apiKey = "8256913518066dd0a6d23e992a49bf53";

async function test() {
  const submitRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-imagine/image-to-video",
      input: {
        prompt: "A beautiful sunset over the ocean, cinematic, 4k",
        mode: "normal",
        duration: "6",
        resolution: "480p",
        aspect_ratio: "16:9"
      }
    })
  });
  
  const submitData = await submitRes.json();
  console.log("Submit Response:", submitData);
  
  if (submitData.data && submitData.data.taskId) {
    const taskId = submitData.data.taskId;
    const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const pollData = await pollRes.json();
    console.log("Poll Response:", JSON.stringify(pollData, null, 2));
  }
}
test();
