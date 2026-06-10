const apiKey = "8256913518066dd0a6d23e992a49bf53";
async function test() {
  const pollRes = await fetch("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=8153ac67a6a38065203aebb292d48e81", {
    headers: { "Authorization": `Bearer ${apiKey}` }
  });
  const pollData = await pollRes.json();
  console.log("Poll Response:", JSON.stringify(pollData, null, 2));
}
test();
