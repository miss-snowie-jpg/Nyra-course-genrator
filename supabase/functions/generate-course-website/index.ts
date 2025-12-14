import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId } = await req.json();
    
    console.log('Generating course website for courseId:', courseId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      throw new Error('Course not found');
    }

    console.log('Course found:', course.title);

    // Update status to generating
    await supabase
      .from('courses')
      .update({ website_status: 'generating' })
      .eq('id', courseId);

    // Generate website structure based on course data
    const websiteCode = {
      components: {
        CourseHomePage: `
          <div class="course-home">
            <header class="hero-section">
              <h1>${course.title}</h1>
              <p>${course.description}</p>
              <div class="meta">
                <span>Level: ${course.level}</span>
                <span>Style: ${course.style}</span>
                <span>For: ${course.audience}</span>
              </div>
            </header>
            <section class="modules-grid">
              ${(course.modules as any[]).map((m: any, i: number) => `
                <div class="module-card">
                  <h3>Module ${i + 1}: ${m.title}</h3>
                  <ul>${m.lessons.map((l: string) => `<li>${l}</li>`).join('')}</ul>
                </div>
              `).join('')}
            </section>
          </div>
        `,
        ProgressTracker: `
          <div class="progress-tracker">
            <div class="progress-bar" style="width: 0%"></div>
            <span>0% Complete</span>
          </div>
        `,
        CourseNavigation: `
          <nav class="course-nav">
            ${(course.modules as any[]).map((m: any, i: number) => `
              <a href="#module-${i + 1}">${m.title}</a>
            `).join('')}
          </nav>
        `
      },
      styles: {
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        fontFamily: 'Inter, sans-serif'
      },
      routes: [
        { path: '/', component: 'CourseHomePage' },
        { path: '/module/:id', component: 'ModulePage' },
        { path: '/lesson/:moduleId/:lessonId', component: 'LessonPage' }
      ],
      metadata: {
        title: course.title,
        description: course.description,
        audience: course.audience,
        level: course.level,
        modulesCount: (course.modules as any[]).length,
        lessonsCount: (course.modules as any[]).reduce((acc: number, m: any) => acc + m.lessons.length, 0)
      }
    };

    // Store the generated website code
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        website_code: websiteCode,
        website_status: 'completed'
      })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error updating course:', updateError);
      throw updateError;
    }

    console.log('Course website generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Course website generated successfully',
        websiteCode
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-course-website:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate course website';
    
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
