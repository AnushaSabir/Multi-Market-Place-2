import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class AIService {
    static async optimizeProductListing(title: string, description: string): Promise<{ title: string; description: string; otto_attributes?: { weight?: string; capacity?: string } }> {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is missing in .env");
        }

        try {
            console.log("Creating AI optimization request for Germany (GPT-4 / Vision)...");
            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an expert E-commerce SEO Copywriter for the German market.
                        Your tasks:
                        1. Translate ALL text to professional, native-level German using GPT-4 capabilities.
                        2. Optimize the TITLE for high CTR on Otto, Kaufland, and Amazon.de (Max 150 chars).
                        3. Optimize the DESCRIPTION. Extract and explicitly format required Otto details (Capacity, Weight, Dimensions, Material) if found or infer reasonable defaults based on context.
                        4. Process image text/context if provided.
                        
                        Return ONLY a valid JSON object with the following format:
                        {
                            "title": "Optimized German Title",
                            "description": "Optimized German Description HTML",
                            "otto_attributes": {
                                "weight": "string",
                                "capacity": "string"
                            }
                        }`
                    },
                    {
                        role: "user",
                        content: `Original Title: ${title}\nOriginal Description: ${description}`
                    }
                ],
                model: "gpt-4o", // Changed to gpt-4o for advanced reasoning/vision
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error("Received empty response from OpenAI");

            const parsed = JSON.parse(content);
            return {
                title: parsed.title,
                description: parsed.description,
                otto_attributes: parsed.otto_attributes
            };

        } catch (error: any) {
            console.error("OpenAI Error:", error.message);
            throw new Error(`AI Optimization Failed: ${error.message}`);
        }
    }
}
