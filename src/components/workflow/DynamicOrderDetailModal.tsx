import { useState, useEffect, useRef } from "react";
import { logAuditAction } from "@/hooks/useAuditLogs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  User,
  Calendar,
  ExternalLink,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Bell,
  BellOff,
  Clock,
  FileSpreadsheet,
  Plus,
  DollarSign,
  Printer,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { translations, type Language } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { OrderCostSection } from "@/components/wallet/OrderCostSection";
import type { WorkflowStage } from "@/hooks/useWorkflowStages";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

// Translation mapping for default stage names
const stageNameTranslations: Record<string, Record<Language, string>> = {
  "New": { en: "New", zh: "新订单" },
  "In Production": { en: "In Production", zh: "生产中" },
  "Ready": { en: "Ready", zh: "待发货" },
  "Shipped": { en: "Shipped", zh: "已发货" },
  "Delivered": { en: "Delivered", zh: "已送达" },
};

function translateStageName(name: string, language: Language): string {
  return stageNameTranslations[name]?.[language] || name;
}

interface Comment {
  id: string;
  workflow_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface Attachment {
  id: string;
  workflow_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

interface DynamicOrderDetailModalProps {
  order: OrderWorkflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Language;
  stageLabel: string;
  stageColor: string;
  allStages?: WorkflowStage[];
  onStageChange?: (orderId: string, newStageId: string) => void;
  onToggleNotify?: (orderId: string, notify: boolean) => void;
}

const translations_modal: Record<Language, Record<string, string>> = {
  en: {
    "modal.comments": "Comments",
    "modal.attachments": "Attachments",
    "modal.costs": "Costs",
    "modal.addComment": "Write a comment...",
    "modal.send": "Send",
    "modal.noComments": "No comments yet. Be the first to add one!",
    "modal.noAttachments": "No attachments yet. Upload files to share.",
    "modal.yourName": "Your name",
    "modal.spreadsheet": "Spreadsheet",
    "modal.uploading": "Uploading...",
    "modal.gallery": "Gallery",
    "modal.files": "Files",
    "modal.dropFiles": "Drop files here or click to upload",
    "modal.dragDrop": "Drag & drop files here",
  },
  zh: {
    "modal.comments": "评论",
    "modal.attachments": "附件",
    "modal.costs": "费用",
    "modal.addComment": "写评论...",
    "modal.send": "发送",
    "modal.noComments": "暂无评论，成为第一个评论的人！",
    "modal.noAttachments": "暂无附件，上传文件以共享。",
    "modal.yourName": "你的名字",
    "modal.spreadsheet": "表格",
    "modal.uploading": "上传中...",
    "modal.gallery": "相册",
    "modal.files": "文件",
    "modal.dropFiles": "拖放文件到这里或点击上传",
    "modal.dragDrop": "拖放文件到这里",
  },
};

function isSpreadsheetFile(fileType: string | null, fileName: string) {
  if (!fileType && !fileName) return false;
  const spreadsheetTypes = ['spreadsheet', 'excel', 'xlsx', 'xls', 'csv', 'sheet'];
  const spreadsheetExts = ['.xlsx', '.xls', '.csv', '.ods'];
  if (fileType && spreadsheetTypes.some(t => fileType.includes(t))) return true;
  return spreadsheetExts.some(ext => fileName.toLowerCase().endsWith(ext));
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-5 w-5" />;
  if (fileType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-destructive" />;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("xlsx")) 
    return <FileSpreadsheet className="h-5 w-5 text-primary" />;
  return <File className="h-5 w-5" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(fileType: string | null) {
  return fileType?.startsWith("image/") ?? false;
}

function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onDelete,
}: {
  images: Attachment[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDelete: (attachment: Attachment) => void;
}) {
  const currentImage = images[currentIndex];
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  if (!currentImage) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/20 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/20 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      <motion.img
        key={currentImage.id}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        src={currentImage.file_url}
        alt={currentImage.file_name}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
        <span className="text-white text-sm font-medium">{currentImage.file_name}</span>
        <span className="text-white/60 text-xs">{currentIndex + 1} / {images.length}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" asChild>
            <a href={currentImage.file_url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-red-500/80"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(currentImage);
              if (images.length === 1) onClose();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function DynamicOrderDetailModal({
  order,
  open,
  onOpenChange,
  language,
  stageLabel,
  stageColor,
  allStages,
  onStageChange,
  onToggleNotify,
}: DynamicOrderDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(() => {
    // Admin: use username from token; Agent: use saved name
    const token = localStorage.getItem("admin-auth-token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        if (decoded.exp && decoded.exp > Date.now()) return decoded.username || "Admin";
      } catch {}
    }
    return localStorage.getItem("comment-author-name") || "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTotalCost, setCurrentTotalCost] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string) => translations_modal[language][key] || translations[language][key] || key;
  const dateLocale = language === "zh" ? zhCN : enUS;

  const imageAttachments = attachments.filter((a) => isImageFile(a.file_type));
  const otherAttachments = attachments.filter((a) => !isImageFile(a.file_type));

  useEffect(() => {
    if (!order?.id || !open) return;
    setCurrentTotalCost(order.total_cost);

    const loadData = async () => {
      setIsLoading(true);
      const [commentsRes, attachmentsRes] = await Promise.all([
        supabase.from("order_comments").select("*").eq("workflow_id", order.id).order("created_at", { ascending: true }),
        supabase.from("order_attachments").select("*").eq("workflow_id", order.id).order("created_at", { ascending: false }),
      ]);
      if (commentsRes.data) setComments(commentsRes.data);
      if (attachmentsRes.data) setAttachments(attachmentsRes.data);
      setIsLoading(false);
    };

    loadData();

    const commentsChannel = supabase
      .channel(`comments-${order.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_comments", filter: `workflow_id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setComments((prev) => [...prev, payload.new as Comment]);
          else if (payload.eventType === "DELETE") setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      ).subscribe();

    const attachmentsChannel = supabase
      .channel(`attachments-${order.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_attachments", filter: `workflow_id=eq.${order.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") setAttachments((prev) => [payload.new as Attachment, ...prev]);
          else if (payload.eventType === "DELETE") setAttachments((prev) => prev.filter((a) => a.id !== payload.old.id));
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(attachmentsChannel);
    };
  }, [order?.id, open]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !order?.id) return;
    const name = authorName.trim() || "Anônimo";
    localStorage.setItem("comment-author-name", name);
    const { error } = await supabase.from("order_comments").insert({ workflow_id: order.id, author_name: name, content: newComment.trim() });
    if (error) {
      toast.error(language === "zh" ? "添加评论失败" : "Failed to add comment");
    } else {
      // Create activity notification
      await supabase.from("activity_notifications").insert({
        workflow_id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        activity_type: "comment",
        description: newComment.trim().substring(0, 100),
        created_by: name,
      });
      // Audit log
      logAuditAction({
        action_type: 'comment_added',
        order_number: order.order_number,
        customer_name: order.customer_name,
        description: `Comment by ${name}: ${newComment.trim().substring(0, 80)}`,
      });
      setNewComment("");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    const { error } = await supabase.from("order_comments").delete().eq("id", commentId);
    if (error) {
      const { data } = await supabase.from("order_comments").select("*").eq("workflow_id", order?.id).order("created_at", { ascending: true });
      if (data) setComments(data);
      toast.error(language === "zh" ? "删除失败" : "Failed to delete");
    }
  };

  const uploadFile = async (file: File) => {
    if (!order?.id) return;
    setIsUploading(true);
    const uploaderName = authorName.trim() || "Anônimo";
    const fileName = `${order.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("order-attachments").upload(fileName, file);
    if (uploadError) { toast.error(language === "zh" ? "上传失败" : "Upload failed"); setIsUploading(false); return; }
    const { data: urlData } = supabase.storage.from("order-attachments").getPublicUrl(fileName);
    await supabase.from("order_attachments").insert({ workflow_id: order.id, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type, file_size: file.size, uploaded_by: uploaderName });
    // Create activity notification
    await supabase.from("activity_notifications").insert({
      workflow_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      activity_type: "attachment",
      description: file.name,
      created_by: uploaderName,
    });
    // Audit log
    logAuditAction({
      action_type: 'attachment_added',
      order_number: order.order_number,
      customer_name: order.customer_name,
      description: `File uploaded by ${uploaderName}: ${file.name}`,
    });
    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    for (const file of Array.from(files)) await uploadFile(file);
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    const urlParts = attachment.file_url.split("/order-attachments/");
    const filePath = urlParts[1];
    if (filePath) await supabase.storage.from("order-attachments").remove([filePath]);
    const { error } = await supabase.from("order_attachments").delete().eq("id", attachment.id);
    if (error) {
      const { data } = await supabase.from("order_attachments").select("*").eq("workflow_id", order?.id).order("created_at", { ascending: false });
      if (data) setAttachments(data);
    }
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextImage = () => { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % imageAttachments.length); };
  const prevImage = () => { if (lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + imageAttachments.length) % imageAttachments.length); };

  if (!order) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight">#{order.order_number}</h2>
                  <Badge className={`${stageColor} text-sm px-3 py-1`}>{stageLabel}</Badge>
                </div>
                <p className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {order.customer_name}
                  {order.customer_email && <span className="text-muted-foreground/60">• {order.customer_email}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(order.created_at), "PPP", { locale: dateLocale })}</span>
                <span className="text-muted-foreground/60">({formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: dateLocale })})</span>
              </div>
              
              {order.spreadsheet_url && (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <a href={order.spreadsheet_url} target="_blank" rel="noopener noreferrer">
                    <FileSpreadsheet className="h-4 w-4" />
                    {t("modal.spreadsheet")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}

              {onToggleNotify && (
                <Button
                  variant={order.notify_customer ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => onToggleNotify(order.id, !order.notify_customer)}
                >
                  {order.notify_customer ? <><Bell className="h-4 w-4" />{language === "zh" ? "通知开启" : "Notify On"}</> : <><BellOff className="h-4 w-4" />{language === "zh" ? "通知关闭" : "Notify Off"}</>}
                </Button>
              )}

              {allStages && onStageChange && (
                <Select value={order.stage_id || ""} onValueChange={(value) => onStageChange(order.id, value)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          {translateStageName(stage.name, language)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="default" size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" asChild>
                <a
                  href={`/slip/${order.order_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4" />
                  {language === 'zh' ? '查看装箱单' : 'View Packing Slip'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="comments" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 border-b shrink-0">
              <TabsList className="h-12 w-full justify-start rounded-none border-0 bg-transparent p-0">
                <TabsTrigger value="comments" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t("modal.comments")}
                  {comments.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{comments.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="costs" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground">
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t("modal.costs")}
                  {currentTotalCost !== null && currentTotalCost > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      ${currentTotalCost.toFixed(0)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="attachments" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground">
                  <Paperclip className="h-4 w-4 mr-2" />
                  {t("modal.attachments")}
                  {attachments.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{attachments.length}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="comments" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-4">
                  {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-muted p-4 mb-4"><MessageSquare className="h-8 w-8 text-muted-foreground" /></div>
                      <p className="text-muted-foreground">{t("modal.noComments")}</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <motion.div key={comment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group">
                        <div className="flex gap-3">
                          <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">{comment.author_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">{comment.author_name}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}
                              </span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100" onClick={() => handleDeleteComment(comment.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t bg-muted/20 shrink-0">
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input placeholder={t("modal.yourName")} value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="h-9 text-sm bg-background" />
                    <Textarea placeholder={t("modal.addComment")} value={newComment} onChange={(e) => setNewComment(e.target.value)} className="min-h-[80px] text-sm resize-none bg-background" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment(); }} />
                    <div className="flex justify-end">
                      <Button onClick={handleAddComment} disabled={!newComment.trim()} className="gap-2">
                        <Send className="h-4 w-4" />
                        {t("modal.send")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="costs" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                <div className="px-6 py-4">
                  <OrderCostSection
                    workflowId={order.id}
                    orderNumber={order.order_number}
                    customerName={order.customer_name}
                    currentTotalCost={currentTotalCost}
                    language={language}
                    onTotalCostUpdate={setCurrentTotalCost}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="attachments" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-6">
                  {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : attachments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-muted p-4 mb-4"><Paperclip className="h-8 w-8 text-muted-foreground" /></div>
                      <p className="text-muted-foreground">{t("modal.noAttachments")}</p>
                    </div>
                  ) : (
                    <>
                      {imageAttachments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            {t("modal.gallery")} ({imageAttachments.length})
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {imageAttachments.map((attachment, index) => (
                              <motion.div key={attachment.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer group ring-1 ring-border" onClick={() => openLightbox(index)}>
                                <img src={attachment.file_url} alt={attachment.file_name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(attachment); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {otherAttachments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <File className="h-4 w-4" />
                            {t("modal.files")} ({otherAttachments.length})
                          </h4>
                          <div className="space-y-2">
                            {otherAttachments.map((attachment) => (
                              <motion.div key={attachment.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 bg-muted/50 hover:bg-muted/80 transition-colors rounded-xl p-4 group">
                                <div className="shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center ring-1 ring-border">{getFileIcon(attachment.file_type)}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                                  <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)} • {attachment.uploaded_by} • {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true, locale: dateLocale })}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isSpreadsheetFile(attachment.file_type, attachment.file_name) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" asChild>
                                      <a
                                        href={attachment.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={language === 'zh' ? '在网页中打开' : 'Open on web'}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download><Download className="h-4 w-4" /></a>
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDeleteAttachment(attachment)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t bg-muted/20 shrink-0">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}`}
                >
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} multiple />
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">{t("modal.uploading")}</p></div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Plus className="h-4 w-4 text-primary" /></div>
                      <p className="text-sm font-medium">{isDragging ? t("modal.dragDrop") : t("modal.dropFiles")}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox images={imageAttachments} currentIndex={lightboxIndex} onClose={closeLightbox} onNext={nextImage} onPrev={prevImage} onDelete={handleDeleteAttachment} />
        )}
      </AnimatePresence>
    </>
  );
}
