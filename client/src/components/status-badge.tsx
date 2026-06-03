import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let variantStyles = "bg-gray-100 text-gray-800 border-gray-200";

  switch (status?.toLowerCase()) {
    case "intake":
    case "open":
    case "draft":
      variantStyles = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case "klargjøring":
    case "inprogress":
      variantStyles = "bg-amber-50 text-amber-700 border-amber-200";
      break;
    case "naf":
    case "inspection":
      variantStyles = "bg-purple-50 text-purple-700 border-purple-200";
      break;
    case "listed":
    case "done":
    case "pass":
      variantStyles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    case "sold":
    case "delivered":
    case "paid":
      variantStyles = "bg-slate-800 text-slate-100 border-slate-700";
      break;
    case "fail":
    case "rejected":
    case "cancelled":
      variantStyles = "bg-red-50 text-red-700 border-red-200";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm",
        variantStyles,
        className
      )}
    >
      {status}
    </span>
  );
}
