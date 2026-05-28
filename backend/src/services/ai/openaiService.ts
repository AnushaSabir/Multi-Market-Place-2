import OpenAI from 'openai';
import { supabase } from '../../database/supabaseClient';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface OptimizedContent {
    title: string;
    description: string;
    seo_keywords: string[];
    german_translation?: {
        title: string;
        description: string;
    };
}

// Helper to analyze images using Vision AI
async function analyzeProductImages(imageUrls: string[]): Promise<string> {
    if (!process.env.OPENAI_API_KEY || imageUrls.length === 0) return "";

    try {
        // Prepare content array with images (limit to first 3 images to save tokens/time)
        const content: any[] = [
            { type: "text", text: "Please look at these product images. If there is any English text (like features, dimensions, instructions) written inside the images, extract it and translate it to German. Format it as an HTML bulleted list. If there is no text in the images, just return an empty string." }
        ];

        const imagesToAnalyze = imageUrls.slice(0, 3);
        for (const url of imagesToAnalyze) {
            content.push({
                type: "image_url",
                image_url: { url: url }
            });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content }],
            max_tokens: 500
        });

        const resultText = response.choices[0].message.content || "";
        return resultText.trim();
    } catch (e: any) {
        console.error("Vision AI Error:", e.message);
        return ""; // Fail gracefully
    }
}

export async function optimizeProduct(productId: string): Promise<{ success: boolean; data?: OptimizedContent; error?: string }> {
    try {
        // 1. Fetch Product
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) throw new Error('Product not found');

        // 2. Prepare Prompt
        const prompt = `
      You are an ecommerce SEO expert. Analyze and optimize the following product data.
      Return strictly a JSON object with the following structure:
      {
        "title": "Optimized Title (max 150 chars, include keywords, persuasive)",
        "description": "Optimized Description (HTML format, bullet points for features, SEO improved)",
        "seo_keywords": ["keyword1", "keyword2", "keyword3"],
        "german_translation": {
            "title": "German title",
            "description": "German description"
        }
      }

      Input Data:
      Title: ${product.title}
      Description: ${product.description}
      Category/Keywords: ${product.sku || ''}
    `;

        // 3. Call OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // or gpt-3.5-turbo if cost is issue, gpt-4o preferred for multilingual
            messages: [{ role: "system", content: "You are a helpful assistant that outputs JSON." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");

        const optimizedData: OptimizedContent = JSON.parse(content);

        // 3.5 Use Vision AI for Image Text Translation
        let imageTranslationHtml = "";
        try {
            let images: string[] = [];
            if (typeof product.images === 'string') {
                images = JSON.parse(product.images);
            } else if (Array.isArray(product.images)) {
                images = product.images;
            }

            if (images && images.length > 0) {
                console.log(`[AI] Analyzing ${images.length} images for text translation...`);
                const visionResult = await analyzeProductImages(images);
                if (visionResult && visionResult.length > 10) {
                    imageTranslationHtml = `<br/><br/><strong>Informationen aus Bildern:</strong><br/>${visionResult}`;
                }
            }
        } catch (visionError) {
            console.error("Failed to parse images or run vision AI:", visionError);
        }

        // Append image translation to description
        const finalDescription = optimizedData.description + imageTranslationHtml;

        // 4. Update Product in DB
        // We update the main fields? Or store optimized strings separately?
        // Requirement says "Optimizes Title, Description". 
        // We update status to 'optimized'.

        const { error: updateError } = await supabase
            .from('products')
            .update({
                title: optimizedData.title, 
                description: finalDescription,
                status: 'optimized'
            })
            .eq('id', productId);

        if (updateError) throw new Error(updateError.message);

        return { success: true, data: optimizedData };

    } catch (err: any) {
        console.error("AI Optimization Failed:", err);
        return { success: false, error: err.message };
    }
}
