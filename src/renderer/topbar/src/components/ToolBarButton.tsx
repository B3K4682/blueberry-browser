import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "../../../common/lib/utils";

interface ToolBarButtonProps {
    Icon?: LucideIcon;
    active?: boolean;
    toggled?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
    className?: string;
}

// Toolbar icon control; when active is false the control is non-interactive and muted.
export const ToolBarButton: React.FC<ToolBarButtonProps> = ({
    Icon,
    active = true,
    toggled = false,
    onClick,
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                "size-8 flex items-center justify-center rounded-md",
                "text-secondary-foreground app-region-no-drag",
                "transition-all duration-200",
                !active
                    ? "cursor-default pointer-events-none text-muted-foreground/40"
                    : "hover:bg-muted active:brightness-95 cursor-pointer",
                toggled && "bg-muted",
                className
            )}
            onClick={active ? onClick : undefined}
            tabIndex={-1}
        >
            {children || (Icon && <Icon className="size-4.5" />)}
        </div>
    );
};
