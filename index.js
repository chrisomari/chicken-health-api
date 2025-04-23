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
    const jsonString = markdown.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing markdown response:", error);
    throw new Error("Failed to parse model response");
  }
}

// Well-structured disease recommendations
const diseaseRecommendations = {
  coccidiosis: {
    diagnosis: "Coccidiosis - Intestinal Parasite Infection",
    description: "Caused by Eimeria parasites damaging intestinal walls",
    recommendation: {
      overview: "This parasitic infection requires immediate treatment and coop management to prevent spread.",
      treatments: [
        {
          name: "Corid (Amprolium)",
          dosage: "2 teaspoons per gallon of drinking water",
          duration: "5-7 days",
          mechanism: "Starves parasites of essential nutrients"
        },
        {
          name: "Baycox (Toltrazuril) - for severe cases",
          dosage: "Single dose treatment",
          mechanism: "Effective against all parasite growth stages"
        }
      ],
      management: [
        "Remove wet litter DAILY (parasites thrive in moisture)",
        "Disinfect with 10% ammonia solution (not bleach)",
        "Provide electrolyte supplements in water"
      ],
      prevention: [
        "Maintain clean, dry feeders and drinkers",
        "Avoid overcrowding to reduce transmission",
        "Consider coccidiosis vaccine for new chicks"
      ],
      vetAdvice: [
        "Fecal testing to confirm parasite type",
        "Exact medication dosing for your flock size",
        "Follow-up treatment plan"
      ]
    }
  },
  newcastle: {
    diagnosis: "Newcastle Disease - Viral Infection",
    description: "Highly contagious paramyxovirus infection with neurological symptoms",
    recommendation: {
      emergencyActions: [
        {
          action: "Vaccination (LaSota strain)",
          details: "Administer to healthy birds via eye/nose drops for immediate immunity boost"
        },
        {
          action: "Isolation Protocol",
          details: "Separate sick birds in different building with dedicated equipment"
        },
        {
          action: "Supportive Care",
          details: "Vitamin supplements in water and maintain warm, stress-free environment"
        }
      ],
      criticalInfo: [
        "80-90% mortality in unvaccinated flocks",
        "Spreads through air, feces, and equipment",
        "Can devastate entire poultry operations"
      ],
      vetRequirements: [
        "Immediate official diagnosis required by law",
        "Proper containment procedures",
        "Safe disposal of deceased birds"
      ]
    }
  }
};

// Helper function to format recommendations
function formatRecommendation(recommendation) {
  let formatted = [];
  
  if (recommendation.overview) {
    formatted.push(`OVERVIEW:\n${recommendation.overview}\n`);
  }

  if (recommendation.treatments) {
    formatted.push("TREATMENT OPTIONS:");
    recommendation.treatments.forEach(treatment => {
      formatted.push(`- ${treatment.name}`);
      formatted.push(`  Dosage: ${treatment.dosage}`);
      formatted.push(`  Duration: ${treatment.duration}`);
      formatted.push(`  Mechanism: ${treatment.mechanism}\n`);
    });
  }

  if (recommendation.emergencyActions) {
    formatted.push("EMERGENCY PROTOCOL:");
    recommendation.emergencyActions.forEach(action => {
      formatted.push(`- ${action.action}`);
      formatted.push(`  Details: ${action.details}\n`);
    });
  }

  if (recommendation.management) {
    formatted.push("COOP MANAGEMENT:");
    recommendation.management.forEach(item => {
      formatted.push(`- ${item}`);
    });
    formatted.push("");
  }

  if (recommendation.criticalInfo) {
    formatted.push("WHY THIS IS CRITICAL:");
    recommendation.criticalInfo.forEach(info => {
      formatted.push(`- ${info}`);
    });
    formatted.push("");
  }

  if (recommendation.vetAdvice || recommendation.vetRequirements) {
    formatted.push("VETERINARY INVOLVEMENT REQUIRED:");
    const vetItems = recommendation.vetAdvice || recommendation.vetRequirements;
    vetItems.forEach(item => {
      formatted.push(`- ${item}`);
    });
  }

  return formatted;
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

      If not chicken feces, respond: "This does not appear to be chicken feces."

      Respond in JSON format ONLY, with this exact structure:
      {
        "isFeces": boolean,
        "healthStatus": "healthy|coccidiosis|newcastle|unknown",
        "confidence": "high|medium|low",
        "description": "string"
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
    
    const jsonResponse = extractJsonFromMarkdown(text);
    
    if (jsonResponse.isFeces && jsonResponse.healthStatus in diseaseRecommendations) {
      const diseaseInfo = diseaseRecommendations[jsonResponse.healthStatus];
      jsonResponse.diagnosis = diseaseInfo.diagnosis;
      jsonResponse.description = diseaseInfo.description;
      jsonResponse.recommendation = formatRecommendation(diseaseInfo.recommendation);
    } else if (jsonResponse.isFeces) {
      jsonResponse.recommendation = ["No specific treatment needed. Maintain normal coop hygiene."];
    }

    res.json(jsonResponse);

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
