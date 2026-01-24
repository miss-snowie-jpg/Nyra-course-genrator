import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    
    if (!topic) {
      throw new Error("Topic is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating course for topic:", topic);

    // Use AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert course curriculum designer. Create comprehensive, well-structured courses with full lesson content and quizzes. Return courses in JSON format with the following structure:
{
  "title": "Course Title",
  "description": "Brief course description (2-3 sentences)",
  "modules": [
    {
      "title": "Module Title",
      "lessons": [
        {
          "title": "Lesson Title",
          "content": "Full lesson content with detailed explanations, examples, and key takeaways. Use markdown formatting for headers (##), bullet points (-), bold (**text**), and code blocks if relevant. Content should be 200-300 words per lesson.",
          "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
        }
      ],
      "quiz": {
        "title": "Module Quiz",
        "questions": [
          {
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctIndex": 0,
            "explanation": "Brief explanation of why this answer is correct"
          }
        ]
      }
    }
  ]
}
Create 3-4 modules with 2-3 lessons each. Each module must have a quiz with 3-4 questions to test student understanding. Be specific, practical, and include real-world examples.`,
            },
            {
              role: "user",
              content: `Create a comprehensive course about: ${topic}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 8000,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response from the AI
      let course;
      try {
        // First try direct parsing
        course = JSON.parse(content);
      } catch (e) {
        console.log("Direct JSON parse failed, attempting extraction...");
        
        // Try to extract JSON from various markdown code block formats
        let jsonString = content;
        
        // Try ```json blocks first
        const jsonCodeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonCodeBlockMatch) {
          jsonString = jsonCodeBlockMatch[1].trim();
        } else {
          // Try to find JSON object directly (starts with { and ends with })
          const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonString = jsonObjectMatch[0];
          }
        }
        
        // Clean up common JSON issues
        // Remove trailing commas before } or ]
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        // Remove any BOM or invisible characters
        jsonString = jsonString.replace(/^\uFEFF/, '').trim();
        
        try {
          course = JSON.parse(jsonString);
        } catch (parseError) {
          console.error("Failed to parse extracted JSON:", jsonString.substring(0, 500));
          throw new Error("Failed to parse course structure from AI response");
        }
      }

      console.log("Course generated successfully with", course.modules?.length || 0, "modules");

      return new Response(JSON.stringify({ course }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("Request timed out");
        throw new Error("Course generation timed out. Please try again.");
      }
      throw fetchError;
    }

  } catch (error) {
    console.error("Error in generate-course function:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate course";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});