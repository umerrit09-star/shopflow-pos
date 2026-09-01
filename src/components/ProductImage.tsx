import { Package } from "lucide-react";
import { useSignedUrl } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ProductImage({
  path,
  title,
  className,
}: {
  path: string | null | undefined;
  title: string;
  className?: string;
}) {
  const url = useSignedUrl(path);
  return (
    <div className={cn("grid place-items-center overflow-hidden rounded-xl bg-secondary", className)}>
      {url ? (
        <img src={url} alt={title} className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-6 text-muted-foreground" />
      )}
    </div>
  );
}
