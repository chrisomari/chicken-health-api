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
          duration: "One-time administration",
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
      overview: "This deadly viral disease requires immediate containment measures.",
      treatments: [
        {
          name: "Vaccination (LaSota strain)",
          dosage: "Administer via eye/nose drops",
          duration: "Immediate for healthy birds",
          mechanism: "Boosts immunity against the virus"
        }
      ],
      management: [
        "Isolate sick birds in separate building",
        "Use dedicated tools/clothes for infected area",
        "Add vitamin supplements to water"
      ],
      criticalInfo: [
        "80-90% mortality in unvaccinated flocks",
        "Spreads through air, feces, and equipment",
        "Reportable disease in most jurisdictions"
      ],
      vetAdvice: [
        "Immediate official diagnosis required",
        "Proper containment procedures",
        "Safe disposal of deceased birds"
      ]
    }
  },
  healthy: {
    recommendation: {
      overview: "Normal chicken droppings indicate good health.",
      maintenance: [
        "Continue regular feeding schedule",
        "Provide clean water daily",
        "Monitor for any changes in droppings"
      ]
    }
  }
};

// Format recommendations with clean structure
function formatRecommendation(recommendation) {
  let formatted = "";
  
  // Overview section
  if (recommendation.overview) {
    formatted += `OVERVIEW:\n${recommendation.overview}\n\n`;
  }

  // Treatments section
  if (recommendation.treatments) {
    formatted += "TREATMENT OPTIONS:\n";
    recommendation.treatments.forEach(treatment => {
      formatted += `• ${treatment.name}\n`;
      formatted += `  → Dosage: ${treatment.dosage}\n`;
      formatted += `  → Duration: ${treatment.duration}\n`;
      formatted += `  → Action: ${treatment.mechanism}\n\n`;
    });
  }

  // Management section
  if (recommendation.management) {
    formatted += "MANAGEMENT:\n";
    recommendation.management.forEach(item => {
      formatted += `• ${item}\n`;
    });
    formatted += "\n";
  }

  // Prevention section
  if (recommendation.prevention) {
    formatted += "PREVENTION:\n";
    recommendation.prevention.forEach(item => {
      formatted += `• ${item}\n`;
    });
    formatted += "\n";
  }

  // Critical info section
  if (recommendation.criticalInfo) {
    formatted += "IMPORTANT NOTES:\n";
    recommendation.criticalInfo.forEach(item => {
      formatted += `• ${item}\n`;
    });
    formatted += "\n";
  }

  // Vet advice section
  if (recommendation.vetAdvice) {
    formatted += "VETERINARY CARE:\n";
    recommendation.vetAdvice.forEach(item => {
      formatted += `• ${item}\n`;
    });
  }

  return formatted.trim();
}

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this image of chicken feces and determine its health status:
      1. Healthy: Brown with white urate cap, firm consistency.
      2. Coccidiosis: Yellow-brown, watery feces with mucus, lacking blood; in severe cases, feces turn bloody, tar-like, and may contain intestinal lining.
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
    
    // Enhance response with formatted recommendations
    if (jsonResponse.isFeces) {
      if (jsonResponse.healthStatus in diseaseRecommendations) {
        const diseaseInfo = diseaseRecommendations[jsonResponse.healthStatus];
        jsonResponse.diagnosis = diseaseInfo.diagnosis || "Normal chicken feces";
        jsonResponse.description = diseaseInfo.description || "Healthy digestive system";
        jsonResponse.recommendation = formatRecommendation(diseaseInfo.recommendation);
      } else {
        jsonResponse.recommendation = formatRecommendation(diseaseRecommendations.healthy.recommendation);
      }
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
