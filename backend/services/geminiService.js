const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

const analyzePotholeImage = async (base64Image) => {
  try {
    const modelId = 'gemini-2.5-flash';

    const prompt = [
      'Classify this upload for a pothole-reporting app.',
      'Accept only clear real-world road-surface potholes or visible road damage.',
      'Reject clean roads, already-good roads, no-hole scenes, spam, memes, selfies, screenshots, documents, indoor images, person-only images, vehicle-only images, blurry images, and irrelevant images.',
      'Set isPothole=true only when actual road damage is visible.',
      "If rejected, set severity='Low', estimatedRepairCost='N/A', and provide a short rejectionReason.",
      'If accepted, return a compact factual description and rough INR repair cost.'
    ].join(' ');

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPothole: { type: Type.BOOLEAN },
            severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
            description: { type: Type.STRING },
            estimatedRepairCost: { type: Type.STRING },
            rejectionReason: { type: Type.STRING }
          },
          required: ['isPothole', 'severity', 'description']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    const result = JSON.parse(text);

    return {
      isPothole: result.isPothole,
      severity: result.severity,
      description: result.description,
      estimatedRepairCost: result.estimatedRepairCost || (result.isPothole ? 'Pending estimate' : 'N/A'),
      rejectionReason: result.rejectionReason || ''
    };
  } catch (error) {
    console.error('Gemini Analysis Failed:', error);
    return {
      isPothole: false,
      severity: 'Low',
      description: 'Image could not be verified as road damage.',
      estimatedRepairCost: 'N/A',
      rejectionReason: 'Upload a clear road photo showing the pothole.'
    };
  }
};

module.exports = {
  analyzePotholeImage
};
