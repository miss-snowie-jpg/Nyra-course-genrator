 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Download, Loader2 } from "lucide-react";
 import { toast } from "sonner";
 import jsPDF from "jspdf";
 
 interface Lesson {
   title: string;
   content: string;
   keyPoints?: string[];
 }
 
 interface Module {
   title: string;
   lessons: Lesson[] | string[];
 }
 
 interface PDFDownloadProps {
   courseTitle: string;
   modules: Module[];
   currentModuleIndex?: number;
   currentLessonIndex?: number;
   downloadType: 'lesson' | 'module' | 'course';
 }
 
 export const PDFDownload = ({ 
   courseTitle, 
   modules, 
   currentModuleIndex = 0,
   currentLessonIndex = 0,
   downloadType 
 }: PDFDownloadProps) => {
   const [downloading, setDownloading] = useState(false);
 
   const getLessonData = (lesson: Lesson | string | unknown): { title: string; content: string; keyPoints: string[] } => {
     if (typeof lesson === 'string') {
       return { title: lesson, content: '', keyPoints: [] };
     }
     if (typeof lesson === 'object' && lesson !== null) {
       const obj = lesson as Record<string, unknown>;
       const title = typeof obj.title === 'string' ? obj.title : 'Untitled Lesson';
       const content = typeof obj.content === 'string' ? obj.content : '';
       let keyPoints: string[] = [];
       if (Array.isArray(obj.keyPoints)) {
         keyPoints = obj.keyPoints.map((p: unknown) => 
           typeof p === 'string' ? p : String(p)
         );
       }
       return { title, content, keyPoints };
     }
     return { title: 'Untitled Lesson', content: '', keyPoints: [] };
   };
 
   const stripMarkdown = (text: string): string => {
     return text
       .replace(/\*\*(.*?)\*\*/g, '$1')
       .replace(/##\s?(.*?)(\n|$)/g, '$1\n')
       .replace(/###\s?(.*?)(\n|$)/g, '$1\n')
       .replace(/`([^`]+)`/g, '$1')
       .replace(/```([\s\S]*?)```/g, '$1')
       .replace(/^- /gm, '• ');
   };
 
   const generatePDF = async () => {
     setDownloading(true);
     try {
       const pdf = new jsPDF();
       const pageWidth = pdf.internal.pageSize.getWidth();
       const pageHeight = pdf.internal.pageSize.getHeight();
       const margin = 20;
       const maxWidth = pageWidth - margin * 2;
       let yPos = margin;
 
       const addText = (text: string, fontSize: number, isBold = false) => {
         pdf.setFontSize(fontSize);
         pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
         
         const lines = pdf.splitTextToSize(text, maxWidth);
         const lineHeight = fontSize * 0.5;
         
         for (const line of lines) {
           if (yPos + lineHeight > pageHeight - margin) {
             pdf.addPage();
             yPos = margin;
           }
           pdf.text(line, margin, yPos);
           yPos += lineHeight;
         }
         yPos += 5;
       };
 
       const addLesson = (lesson: Lesson | string, lessonNum: number) => {
         const data = getLessonData(lesson);
         addText(`Lesson ${lessonNum}: ${data.title}`, 14, true);
         
         if (data.content) {
           addText(stripMarkdown(data.content), 11);
         }
         
         if (data.keyPoints && data.keyPoints.length > 0) {
           yPos += 5;
           addText('Key Takeaways:', 12, true);
           data.keyPoints.forEach((point, i) => {
             addText(`${i + 1}. ${point}`, 11);
           });
         }
         yPos += 10;
       };
 
       // Title
       addText(courseTitle, 20, true);
       yPos += 10;
 
       if (downloadType === 'lesson') {
         const module = modules[currentModuleIndex];
         if (module) {
           addText(`Module ${currentModuleIndex + 1}: ${module.title}`, 16, true);
           yPos += 5;
           const lesson = module.lessons[currentLessonIndex];
           if (lesson) {
             addLesson(lesson, currentLessonIndex + 1);
           }
         }
       } else if (downloadType === 'module') {
         const module = modules[currentModuleIndex];
         if (module) {
           addText(`Module ${currentModuleIndex + 1}: ${module.title}`, 16, true);
           yPos += 5;
           module.lessons.forEach((lesson, idx) => {
             addLesson(lesson, idx + 1);
           });
         }
       } else {
         modules.forEach((module, modIdx) => {
           addText(`Module ${modIdx + 1}: ${module.title}`, 16, true);
           yPos += 5;
           module.lessons.forEach((lesson, idx) => {
             addLesson(lesson, idx + 1);
           });
           yPos += 10;
         });
       }
 
       const filename = downloadType === 'lesson' 
         ? `${courseTitle}-lesson-${currentLessonIndex + 1}.pdf`
         : downloadType === 'module'
         ? `${courseTitle}-module-${currentModuleIndex + 1}.pdf`
         : `${courseTitle}-full-course.pdf`;
 
       pdf.save(filename.toLowerCase().replace(/\s+/g, '-'));
       toast.success("PDF downloaded successfully!");
     } catch (error) {
       console.error('PDF generation error:', error);
       toast.error("Failed to generate PDF");
     } finally {
       setDownloading(false);
     }
   };
 
   const label = downloadType === 'lesson' 
     ? 'Download Lesson' 
     : downloadType === 'module' 
     ? 'Download Module' 
     : 'Download Course';
 
   return (
     <Button 
       variant="outline" 
       size="sm" 
       onClick={generatePDF}
       disabled={downloading}
     >
       {downloading ? (
         <Loader2 className="w-4 h-4 mr-2 animate-spin" />
       ) : (
         <Download className="w-4 h-4 mr-2" />
       )}
       {label}
     </Button>
   );
 };