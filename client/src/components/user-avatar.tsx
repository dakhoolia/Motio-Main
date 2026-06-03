import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      {avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={name}
          className="object-cover"
        />
      )}
      <AvatarFallback className={cn("bg-primary/10 text-primary font-semibold", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
