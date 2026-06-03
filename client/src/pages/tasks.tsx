import { useState } from "react";
import { Link } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { useTasks, useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, CheckCircle2, Clock, ExternalLink, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS = [
  { id: "Open",       label: "To Do",       color: "bg-blue-500",   border: "border-blue-400/60 dark:border-blue-500/40",   pill: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"   },
  { id: "InProgress", label: "In Progress", color: "bg-amber-500",  border: "border-amber-400/60 dark:border-amber-500/40",  pill: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
  { id: "Done",       label: "Done",        color: "bg-emerald-500", border: "border-emerald-400/60 dark:border-emerald-500/40", pill: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
];

export default function TasksPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: tasks, isLoading } = useTasks();
  const { mutate: updateTask } = useUpdateTask();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  const taskList = tasks || [];
  const activeTask = activeId ? taskList.find(t => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over;
    if (over) {
      const overColId = COLUMNS.find(c => c.id === over.id)?.id;
      if (overColId) setOverId(overColId);
      else {
        const overTask = taskList.find(t => t.id === Number(over.id));
        if (overTask) setOverId(overTask.status);
      }
    } else {
      setOverId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    const draggedTask = taskList.find(t => t.id === Number(active.id));
    if (!draggedTask) return;

    let targetStatus: string | null = null;
    const colMatch = COLUMNS.find(c => c.id === over.id);
    if (colMatch) {
      targetStatus = colMatch.id;
    } else {
      const overTask = taskList.find(t => t.id === Number(over.id));
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus && targetStatus !== draggedTask.status) {
      updateTask({ id: draggedTask.id, status: targetStatus as any });
    }
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1">Drag cards between columns to update status</p>
          </div>
          <CreateTaskDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {COLUMNS.map(col => {
              const colTasks = taskList.filter(t => t.status === col.id);
              const isDropTarget = overId === col.id && activeId !== null;
              return (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={colTasks}
                  isDropTarget={isDropTarget}
                  activeId={activeId}
                  onStatusChange={(id, status) => updateTask({ id, status: status as any })}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
            {activeTask ? (
              <TaskCard task={activeTask} onStatusChange={() => {}} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </LayoutShell>
  );
}

function KanbanColumn({ col, tasks, isDropTarget, activeId, onStatusChange }: {
  col: typeof COLUMNS[0];
  tasks: any[];
  isDropTarget: boolean;
  activeId: number | null;
  onStatusChange: (id: number, status: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`glass-card rounded-2xl p-4 min-h-[200px] flex flex-col transition-all duration-150 border-2 ${
        isDropTarget
          ? `${col.border} ring-2 ring-offset-2 ring-offset-background ${col.color.replace("bg-", "ring-")}/30`
          : "border-black/[0.07] dark:border-white/[0.10]"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
        <h3 className="font-semibold text-[13px] text-foreground">{col.label}</h3>
        <span className={`text-[11px] ml-auto px-2 py-0.5 rounded-full font-semibold ${col.pill}`}>
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5 flex-1">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              isDragging={task.id === activeId}
            />
          ))}
          {tasks.length === 0 && !isDropTarget && (
            <div className="flex-1 flex items-center justify-center min-h-[80px] border-2 border-dashed border-black/[0.08] dark:border-white/[0.08] rounded-xl">
              <p className="text-[12px] text-muted-foreground/50">Drop tasks here</p>
            </div>
          )}
          {isDropTarget && tasks.length === 0 && (
            <div className={`flex-1 min-h-[80px] rounded-xl border-2 border-dashed ${col.border} opacity-60`} />
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function TaskCard({ task, onStatusChange, isDragging, isOverlay }: {
  task: any;
  onStatusChange: (id: number, status: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const priorityStyle =
    task.priority === "High"   ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"    :
    task.priority === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                                 "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  const cardEl = (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white/70 dark:bg-white/[0.05] border border-black/[0.09] dark:border-white/[0.13] rounded-xl transition-all
        ${isOverlay ? "shadow-2xl rotate-1 scale-105 opacity-95" : "hover:shadow-md hover:-translate-y-0.5"}
        ${isDragging ? "opacity-40" : ""}
      `}
      data-testid={`card-task-${task.id}`}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2 mb-2">
          <button
            className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
            {...listeners}
            {...attributes}
            data-testid={`drag-handle-${task.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityStyle}`}>
                {task.priority}
              </span>
              {task.status !== "Done" && (
                <button
                  className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all shrink-0"
                  onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onStatusChange(task.id, "Done"); }}
                  data-testid={`button-complete-task-${task.id}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <h4 className="font-medium text-[13px] text-foreground leading-snug mb-1" data-testid={`text-task-title-${task.id}`}>
              {task.title}
            </h4>

            {task.vehicle ? (
              <div className="flex items-center gap-1 text-[11px] text-primary mb-2.5">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{task.vehicle.year} {task.vehicle.make} {task.vehicle.model}</span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mb-2.5">General Task</p>
            )}

            <div className="flex items-center justify-between pt-2.5 border-t border-black/[0.06] dark:border-white/[0.07]">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No due date"}
              </div>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                {task.assignee ? task.assignee.name.charAt(0).toUpperCase() : "?"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (task.vehicleId && !isOverlay) {
    return (
      <Link href={`/vehicles/${task.vehicleId}`}>
        {cardEl}
      </Link>
    );
  }

  return cardEl;
}

function CreateTaskDialog({ open, onOpenChange }: any) {
  const { mutateAsync: createTask, isPending } = useCreateTask();

  const form = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      priority: "Medium",
      status: "Open",
      type: "General",
    },
  });

  const onSubmit = async (data: any) => {
    await createTask(data);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a new task to the board.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Task description" {...field} data-testid="input-task-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Cleaning">Cleaning</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Paperwork">Paperwork</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-create-task">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
