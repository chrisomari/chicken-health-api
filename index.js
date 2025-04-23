const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const upload = multer();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to extract JSON from Markdown response
function extractJsonFromMarkdown(markdown) {
  try {
    // Remove markdown code block markers
    const jsonString = markdown.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing markdown response:", error);
    throw new Error("Failed to parse model response");
  }
}

// Enhanced recommendations
const diseaseRecommendations = {
  coccidiosis: {
    diagnosis: "Coccidiosis - intestinal parasite infection",
    description: "caused by microscopic parasites (Eimeria) damaging the gut walls",
    recommendation: [
      "TREATMENT OPTIONS:",
      "1. Corid (amprolium) liquid:",
      "   - Mix 2 teaspoons per gallon of drinking water",
      "   - Works by starving the parasites of nutrients",
      "   - Treat for 5-7 days total",
      "",
      "2. Baycox (toltrazuril) for severe cases:",
      "   - Single dose treatment",
      "   - Stops all parasite growth stages",
      "",
      "COOP MANAGEMENT:",
      "• Remove wet litter DAILY (parasites multiply in moisture)",
      "• Disinfect with 10% ammonia solution (bleach doesn't work)",
      "• Provide electrolyte supplements in water",
      "",
      "PREVENTION:",
      "• Keep feeders/drinkers clean and dry",
      "• Avoid overcrowding (reduces parasite spread)",
      "• Consider coccidiosis vaccine for new chicks",
      "",
      "VET VISIT RECOMMENDED:",
      "- For fecal testing to confirm parasite type",
      "- To calculate exact medication doses for your flock size",
      "- For follow-up treatment plan"
    ]
  },
  newcastle: {
    diagnosis: "Newcastle Disease - deadly viral infection",
    description: "diarrhea with possible neck twisting, caused by highly contagious paramyxovirus",
    recommendation: [
      "EMERGENCY ACTIONS:",
      "1. VACCINATION (LaSota strain):",
      "   - Administer to healthy birds immediately",
      "   - Boosts immunity against the virus",
      "   - Must be given as eye/nose drops for proper protection",
      "",
      "2. ISOLATION:",
      "   - Separate sick birds in different building",
      "   - Use dedicated tools/clothes for infected area",
      "",
      "3. SUPPORTIVE CARE:",
      "   - Add vitamin supplements to water",
      "   - Keep birds warm and stress-free",
      "",
      "WHY THIS IS CRITICAL:",
      "• Kills 80-90% of unvaccinated chickens",
      "• Spreads through air, feces, and equipment",
      "• Can infect other poultry farms nearby",
      "",
      "VET URGENTLY NEEDED:",
      "- For official diagnosis and containment procedures",
      "- For proper disposal of dead birds"
    ]
  }
};

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

      If not chicken feces, respond: "This does not appear to be chicken feces."

      Respond in JSON format ONLY, with this exact structure:
      {
        "isFeces": boolean,
        "healthStatus": "healthy|coccidiosis|newcastle|unknown",
        "confidence": "high|medium|low",
        "description": "string",
        "recommendation": "string"
      }`;

    const image = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    const text = response.text();
    
    // Parse the markdown response
    const jsonResponse = extractJsonFromMarkdown(text);
    
    // Enhance the response with detailed recommendations if disease is detected
    if (jsonResponse.isFeces && jsonResponse.healthStatus in diseaseRecommendations) {
      const diseaseInfo = diseaseRecommendations[jsonResponse.healthStatus];
      jsonResponse.diagnosis = diseaseInfo.diagnosis;
      jsonResponse.description = diseaseInfo.description;
      jsonResponse.recommendation = diseaseInfo.recommendation;
    }

    res.json(jsonResponse);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      error: "Analysis failed", 
      details: error.message,
      fullError: error.stack // For debugging
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
