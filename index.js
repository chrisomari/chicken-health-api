const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const upload = multer();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJsonFromMarkdown(markdown) {
  try {
    const jsonString = markdown.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing markdown response:", error);
    throw new Error("Failed to parse model response");
  }
}

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this image of chicken feces and determine its health status:
      1. Healthy: Brown with white urate cap, firm consistency.
      2. Coccidiosis: Bloody/reddish, watery.
      3. Newcastle: Greenish, watery diarrhea.

      If not chicken feces, respond with isFeces: false.

      Respond in JSON format ONLY with this exact structure:
      {
        "isFeces": boolean,
        "healthStatus": "healthy|coccidiosis|newcastle|unknown",
        "confidence": "high|medium|low",
        "description": "string",
        "recommendation": "string (MUST conclude with 'Consult a veterinarian for proper diagnosis and treatment.')"
      }

      IMPORTANT: 
      - Do not include any additional text or markdown symbols
      - The recommendation MUST end with vet consultation advice`;

    const image = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    const text = response.text();
    
    // Directly return Gemini's parsed response
    const geminiResponse = extractJsonFromMarkdown(text);
    
    // Ensure recommendation ends with vet advice (fallback if Gemini forgets)
    if (geminiResponse.isFeces && !geminiResponse.recommendation.includes("veterinarian")) {
      geminiResponse.recommendation += " Consult a veterinarian for proper diagnosis and treatment.";
    }

    res.json(geminiResponse);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      error: "Analysis failed",
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
