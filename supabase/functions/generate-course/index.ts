import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  english: "Write all content in English. Use clear, concise language accessible to ESL learners.",
  amharic: "Write all content in Amharic (አማርኛ). Use culturally relevant Ethiopian idioms and metaphors. Ensure the language is accessible and encouraging.",
  swahili: "Write all content in Kiswahili. Use East African expressions, proverbs (methali), and culturally relevant examples.",
  french: "Write all content in French. Use African Francophone expressions and examples relevant to West and Central Africa.",
};

const AFRICAN_CONTEXT = `
IMPORTANT CONTEXT - Use African Success Stories and Examples:
- Reference African success stories like M-Pesa, Dangote Group, Ethiopian Airlines, Jumia, Flutterwave, or Andela.
- Align content with AU Agenda 2063 vision of "The Africa We Want".
- Use culturally relevant metaphors and examples that resonate with African learners.
- Be encouraging, professional, and visionary in tone.
- Keep explanations concise and clear to accommodate ESL learners.
- Include practical, actionable steps applicable in African contexts.
`;

const COURSE_TOOL = {
  type: "function" as const,
  function: {
    name: "create_course",
    description: "Create a structured course with modules, lessons, homework and quizzes.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Course title" },
        description: { type: "string", description: "Brief course description (2-3 sentences)" },
        modules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: { type: "string", description: "Full lesson content, 150-250 words. Use markdown. Include African examples." },
                    keyPoints: { type: "array", items: { type: "string" }, description: "3 key takeaways" },
                    homework: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question: { type: "string", description: "Open-ended practice question" },
                          hint: { type: "string", description: "Optional hint" },
                        },
                        required: ["question"],
                      },
                    },
                  },
                  required: ["title", "content", "keyPoints", "homework"],
                },
              },
              quiz: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" }, description: "Exactly 4 options" },
                        correctIndex: { type: "number", description: "0-based index of correct answer" },
                        explanation: { type: "string" },
                      },
                      required: ["question", "options", "correctIndex", "explanation"],
                    },
                  },
                },
                required: ["title", "questions"],
              },
            },
            required: ["title", "lessons", "quiz"],
          },
        },
      },
      required: ["title", "description", "modules"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, language = "english" } = await req.json();

    if (!topic) {
      throw new Error("Topic is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating course for topic:", topic, "in language:", language);

    const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.english;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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
              content: `You are an expert course curriculum designer for African learners.\n\n${AFRICAN_CONTEXT}\n\n${languageInstruction}\n\nCreate 3 modules with 2-3 lessons each. Each lesson needs 2 homework questions. Each module quiz needs 3 questions. Keep lesson content concise (150-250 words). Use the create_course tool to return the course.`,
            },
            {
              role: "user",
              content: `Create a comprehensive course about: ${topic}`,
            },
          ],
          tools: [COURSE_TOOL],
          tool_choice: { type: "function", function: { name: "create_course" } },
          temperature: 0.7,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        if (response.status === 429) {
          throw new Error("AI rate limit reached. Please try again in a moment.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits.");
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      console.log("AI response received, parsing tool call...");

      // Extract from tool call
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== "create_course") {
        // Fallback: try parsing content as JSON
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log("No tool call found, trying content parse fallback...");
          let course;
          try {
            course = JSON.parse(content);
          } catch {
            const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
            const jsonStr = match ? (match[1] || match[0]).trim() : content;
            course = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1"));
          }
          console.log("Course parsed from content with", course.modules?.length || 0, "modules");
          return new Response(JSON.stringify({ course }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI did not return a valid course structure");
      }

      const course = JSON.parse(toolCall.function.arguments);
      console.log("Course generated successfully with", course.modules?.length || 0, "modules");

      return new Response(JSON.stringify({ course }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
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
