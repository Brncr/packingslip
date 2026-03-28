import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings2,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkflowStage } from "@/hooks/useWorkflowStages";
import type { Language } from "@/hooks/useLanguage";

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-gray-500",
];

interface StageManagementProps {
  stages: WorkflowStage[];
  orderCounts: Record<string, number>;
  onAddStage: (name: string, color: string) => Promise<{ success: boolean }>;
  onUpdateStage: (
    id: string,
    updates: Partial<Pick<WorkflowStage, "name" | "color" | "wip_limit">>
  ) => Promise<{ success: boolean }>;
  onDeleteStage: (id: string) => Promise<{ success: boolean }>;
  onReorderStages: (stages: WorkflowStage[]) => Promise<{ success: boolean }>;
  language: Language;
}

const stageTranslations: Record<Language, Record<string, string>> = {
  en: {
    "stages.manage": "Manage Stages",
    "stages.title": "Workflow Stages",
    "stages.subtitle": "Drag to reorder, click to edit",
    "stages.addNew": "Add New Stage",
    "stages.name": "Stage Name",
    "stages.color": "Color",
    "stages.wipLimit": "WIP Limit",
    "stages.wipLimitHint": "Leave empty for no limit",
    "stages.delete": "Delete",
    "stages.cannotDelete": "Cannot delete stage with orders",
    "stages.orderCount": "orders",
    "stages.added": "Stage added",
    "stages.updated": "Stage updated",
    "stages.deleted": "Stage deleted",
    "stages.reordered": "Stages reordered",
    "stages.error": "An error occurred",
    "stages.save": "Save",
    "stages.cancel": "Cancel",
    "stages.done": "Done",
  },
  zh: {
    "stages.manage": "管理阶段",
    "stages.title": "工作流阶段",
    "stages.subtitle": "拖拽排序，点击编辑",
    "stages.addNew": "添加新阶段",
    "stages.name": "阶段名称",
    "stages.color": "颜色",
    "stages.wipLimit": "WIP 限制",
    "stages.wipLimitHint": "留空表示无限制",
    "stages.delete": "删除",
    "stages.cannotDelete": "无法删除有订单的阶段",
    "stages.orderCount": "个订单",
    "stages.added": "阶段已添加",
    "stages.updated": "阶段已更新",
    "stages.deleted": "阶段已删除",
    "stages.reordered": "阶段已重排",
    "stages.save": "保存",
    "stages.cancel": "取消",
    "stages.done": "完成",
    "stages.error": "发生错误",
  },
};

function StageItem({
  stage,
  orderCount,
  onUpdate,
  onDelete,
  language,
}: {
  stage: WorkflowStage;
  orderCount: number;
  onUpdate: (updates: Partial<Pick<WorkflowStage, "name" | "color" | "wip_limit">>) => void;
  onDelete: () => void;
  language: Language;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color);
  const [editWipLimit, setEditWipLimit] = useState(
    stage.wip_limit?.toString() || ""
  );

  const t = (key: string) => stageTranslations[language][key] || key;
  const canDelete = orderCount === 0;

  const handleSave = () => {
    onUpdate({
      name: editName,
      color: editColor,
      wip_limit: editWipLimit ? parseInt(editWipLimit) : null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(stage.name);
    setEditColor(stage.color);
    setEditWipLimit(stage.wip_limit?.toString() || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        layout
        className="bg-card border rounded-lg p-4 space-y-3"
      >
        <div className="space-y-2">
          <Label>{t("stages.name")}</Label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>{t("stages.color")}</Label>
          <div className="flex flex-wrap gap-2">
            {STAGE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setEditColor(color)}
                className={`w-6 h-6 rounded-full ${color} ${
                  editColor === color
                    ? "ring-2 ring-offset-2 ring-primary"
                    : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("stages.wipLimit")}</Label>
          <Input
            type="number"
            min="1"
            value={editWipLimit}
            onChange={(e) => setEditWipLimit(e.target.value)}
            placeholder={t("stages.wipLimitHint")}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            {t("stages.cancel")}
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" />
            {t("stages.save")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <Reorder.Item
      value={stage}
      id={stage.id}
      className="bg-card border rounded-lg p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className={`w-4 h-4 rounded-full ${stage.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{stage.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {orderCount} {t("stages.orderCount")}
          </span>
          {stage.wip_limit && (
            <span className="text-primary">
              WIP: {stage.wip_limit}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${!canDelete ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
          onClick={() => canDelete && onDelete()}
          disabled={!canDelete}
          title={!canDelete ? t("stages.cannotDelete") : t("stages.delete")}
        >
          {!canDelete ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Reorder.Item>
  );
}

export function StageManagement({
  stages,
  orderCounts,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
  onReorderStages,
  language,
}: StageManagementProps) {
  const [open, setOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("bg-blue-500");
  const [localStages, setLocalStages] = useState(stages);

  const t = (key: string) => stageTranslations[language][key] || key;

  // Sync local stages when props change
  if (JSON.stringify(stages) !== JSON.stringify(localStages) && !open) {
    setLocalStages(stages);
  }

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;

    const result = await onAddStage(newStageName.trim(), newStageColor);
    if (result.success) {
      toast.success(t("stages.added"));
      setNewStageName("");
      setNewStageColor("bg-blue-500");
    } else {
      toast.error(t("stages.error"));
    }
  };

  const handleUpdate = async (
    id: string,
    updates: Partial<Pick<WorkflowStage, "name" | "color" | "wip_limit">>
  ) => {
    const result = await onUpdateStage(id, updates);
    if (result.success) {
      toast.success(t("stages.updated"));
    } else {
      toast.error(t("stages.error"));
    }
  };

  const handleDelete = async (id: string) => {
    const result = await onDeleteStage(id);
    if (result.success) {
      toast.success(t("stages.deleted"));
    } else {
      toast.error(t("stages.error"));
    }
  };

  const handleReorder = async (reordered: WorkflowStage[]) => {
    setLocalStages(reordered);
  };

  const handleDragEnd = async () => {
    if (JSON.stringify(localStages) !== JSON.stringify(stages)) {
      const result = await onReorderStages(localStages);
      if (result.success) {
        toast.success(t("stages.reordered"));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          {t("stages.manage")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("stages.title")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("stages.subtitle")}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Add new stage */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <Label>{t("stages.addNew")}</Label>
            <div className="flex gap-2">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder={t("stages.name")}
                onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
              />
              <div className="flex items-center gap-1">
                {STAGE_COLORS.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewStageColor(color)}
                    className={`w-5 h-5 rounded-full ${color} ${
                      newStageColor === color
                        ? "ring-2 ring-offset-1 ring-primary"
                        : ""
                    }`}
                  />
                ))}
              </div>
              <Button size="icon" onClick={handleAddStage}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stage list */}
          <Reorder.Group
            axis="y"
            values={localStages}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {localStages.map((stage) => (
              <StageItem
                key={stage.id}
                stage={stage}
                orderCount={orderCounts[stage.id] || 0}
                onUpdate={(updates) => handleUpdate(stage.id, updates)}
                onDelete={() => handleDelete(stage.id)}
                language={language}
              />
            ))}
          </Reorder.Group>
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              handleDragEnd();
              setOpen(false);
            }}
          >
            {t("stages.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
