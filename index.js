const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const upload = multer();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const extractJsonFromMarkdown = (markdown) => {
  try {
    const jsonString = markdown.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error("Failed to process the analysis");
  }
};

const generateRecommendation = (analysis) => {
  switch(analysis.healthStatus) {
    case 'healthy':
      return {
        diagnosis: "Healthy droppings - normal digestion",
        description: " indicates good health",
        recommendation: "No treatment needed. Continue regular feeding and cleaning routines."
      };
    
    case 'coccidiosis':
      return {
        diagnosis: "Coccidiosis - intestinal parasite infection",
        description: " caused by microscopic parasites (Eimeria) damaging the gut walls",
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
        ].join('\n')
      };
    
    case 'newcastle':
      return {
        diagnosis: "Newcastle Disease - deadly viral infection",
        description: " possible neck twisting. caused by highly contagious paramyxovirus",
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
          "LEGAL REQUIREMENTS:",
          "• You MUST report suspected cases to livestock authorities",
          "• Government may quarantine your farm",
          "",
          "VET URGENTLY NEEDED:",
          "- For official diagnosis and containment procedures",
          "- For proper disposal of dead birds"
        ].join('\n')
      };
    
    case 'non_feces':
      return {
        diagnosis: "Not chicken feces",
        description: "Image doesn't show typical chicken droppings",
        recommendation: [
          "Please submit photos of:",
          "• Fresh chicken feces (not dried out)",
          "• Taken in the chicken enclosure",
          "• With size reference (coin/ruler)",
          "• Showing multiple samples if possible"
        ].join('\n')
      };
    
    default:
      return {
        diagnosis: "Unidentifiable image sample",
        description: "Cannot confirm this is chicken feces due to image quality or content",
        recommendation: [
          "For accurate analysis:",
          "1. Photograph fresh droppings ",
          "2. Use plain white background",
          "3. Ensure good lighting without shadows",
          "4. Avoid photographing ground/environment"
        ].join('\n')
      };
  }
};

app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded",
        recommendation: "Please take a clear photo of chicken droppings and try again"
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Analyze this image strictly for chicken feces:
      1. Healthy: Brown with white urate cap, firm consistency
      2. Coccidiosis: Bloody/reddish, watery appearance
      3. Newcastle: Greenish, watery diarrhea
      
      If clearly NOT chicken feces: non_feces
      If uncertain: unclear

      Respond in this exact JSON format:
      {
        "isChickenFeces": boolean,
        "healthStatus": "healthy|coccidiosis|newcastle|non_feces|unclear",
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
    const analysis = extractJsonFromMarkdown(response.text());
    
    const { diagnosis, description, recommendation } = generateRecommendation(analysis);
    
    res.json({
      ...analysis,
      diagnosis,
      description,
      recommendation
    });

  } catch (error) {
    res.status(500).json({
      error: "Analysis failed",
      recommendation: [
        "Please retry with:",
        "1. Fresh chicken droppings photo",
        "2. Plain background",
        "3. Good lighting",
        "4. Multiple samples if possible"
      ].join('\n')
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
