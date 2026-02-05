 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Input } from "@/components/ui/input";
 import { Share2, Copy, Check, Facebook, Twitter, MessageCircle, Code } from "lucide-react";
 import { toast } from "sonner";
 
 interface ShareCourseProps {
   courseId: string;
   courseTitle: string;
 }
 
 export const ShareCourse = ({ courseId, courseTitle }: ShareCourseProps) => {
   const [copied, setCopied] = useState(false);
   const [embedCopied, setEmbedCopied] = useState(false);
   
   const shareUrl = `${window.location.origin}/course/${courseId}`;
   const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" title="${courseTitle}"></iframe>`;
   
   const copyToClipboard = async (text: string, isEmbed = false) => {
     try {
       await navigator.clipboard.writeText(text);
       if (isEmbed) {
         setEmbedCopied(true);
         setTimeout(() => setEmbedCopied(false), 2000);
       } else {
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
       }
       toast.success("Copied to clipboard!");
     } catch {
       toast.error("Failed to copy");
     }
   };
 
   const shareToWhatsApp = () => {
     const text = encodeURIComponent(`Check out this course: ${courseTitle}\n${shareUrl}`);
     window.open(`https://wa.me/?text=${text}`, '_blank');
   };
 
   const shareToFacebook = () => {
     window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
   };
 
   const shareToTwitter = () => {
     const text = encodeURIComponent(`Check out this course: ${courseTitle}`);
     window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
   };
 
   return (
     <Dialog>
       <DialogTrigger asChild>
         <Button variant="outline" size="sm">
           <Share2 className="w-4 h-4 mr-2" />
           Share
         </Button>
       </DialogTrigger>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Share Course</DialogTitle>
         </DialogHeader>
         
         <div className="space-y-6">
           {/* Direct Link */}
           <div className="space-y-2">
             <label className="text-sm font-medium">Course Link</label>
             <div className="flex gap-2">
               <Input value={shareUrl} readOnly className="flex-1" />
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => copyToClipboard(shareUrl)}
               >
                 {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
               </Button>
             </div>
           </div>
 
           {/* Social Sharing */}
           <div className="space-y-2">
             <label className="text-sm font-medium">Share on Social Media</label>
             <div className="flex gap-2">
               <Button
                 variant="outline"
                 className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-600"
                 onClick={shareToWhatsApp}
               >
                 <MessageCircle className="h-4 w-4 mr-2" />
                 WhatsApp
               </Button>
               <Button
                 variant="outline"
                 className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600"
                 onClick={shareToFacebook}
               >
                 <Facebook className="h-4 w-4 mr-2" />
                 Facebook
               </Button>
               <Button
                 variant="outline"
                 className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600"
                 onClick={shareToTwitter}
               >
                 <Twitter className="h-4 w-4 mr-2" />
                 Twitter
               </Button>
             </div>
           </div>
 
           {/* Embed Code */}
           <div className="space-y-2">
             <label className="text-sm font-medium flex items-center gap-2">
               <Code className="h-4 w-4" />
               Embed Code
             </label>
             <div className="flex gap-2">
               <Input 
                 value={embedCode} 
                 readOnly 
                 className="flex-1 text-xs font-mono" 
               />
               <Button
                 variant="outline"
                 size="icon"
                 onClick={() => copyToClipboard(embedCode, true)}
               >
                 {embedCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
               </Button>
             </div>
             <p className="text-xs text-muted-foreground">
               Paste this code on any website to embed your course
             </p>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 };