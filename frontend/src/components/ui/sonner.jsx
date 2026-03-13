import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

const Toaster = ({ className, toastOptions, ...props }) => {
  return (
    <Sonner
      theme="light"
      className={cn("toaster group", className)}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toaster]:text-muted-foreground",
          actionButton:
            "group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground",
          cancelButton:
            "group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground",
        },
        ...toastOptions,
      }}
      {...props}
    />
  );
};

export { Toaster };
