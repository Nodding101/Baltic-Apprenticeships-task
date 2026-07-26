// llm.ts
import OpenAI from "openai";

// Define the exact categories requested by the brief
export type Category = "Sales" | "Support" | "Complaint" | "Manual Review";

// Initialize the OpenRouter client using the OpenAI SDK format
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // Loaded from your system environment
});

export async function processWithLLM(
  message: string,
): Promise<{ category: Category; summary: string }> {
  const prompt = `
    Analyze the following customer enquiry. 
    1. Categorize it strictly as exactly one of: 'Sales', 'Support', 'Complaint', or 'Manual Review'. (Use 'Manual Review' if it is unclear, mixed, or highly sensitive).
    2. Write a short, one-sentence summary of the core issue.
    
    Output ONLY valid JSON in this exact format: {"category": "...", "summary": "..."}
    
    Enquiry: "${message}"
    `;

  try {
    const response = await openai.chat.completions.create({
      // Use OpenRouter's dynamic free model router
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    }); // Parse the LLM's text response into actual JSON
    const resultString = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(resultString);

    // Safety check: Ensure the LLM didn't hallucinate a fake category
    const validCategories = ["Sales", "Support", "Complaint", "Manual Review"];
    const category = validCategories.includes(result.category)
      ? result.category
      : "Manual Review";

    return {
      category: category as Category,
      summary: result.summary || "Summary generation failed.",
    };
  } catch (error) {
    console.error("LLM Processing Error:", error);
    // Fallback so your server doesn't crash if the API fails
    return {
      category: "Manual Review",
      summary: "System error processing this message. Manual review required.",
    };
  }
}
