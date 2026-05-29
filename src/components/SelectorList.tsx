import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface SelectorListProps<T> {
  title: string;
  description?: string;
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getBadge?: (item: T) => string | undefined;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  selectedCount?: number;
  isLoading: boolean;
  emptyText: string;
}

// Reusable, scrollable selector card: a fixed-height list of checkbox rows.
// Generic over the item type so callers keep their domain shape (MCPItem,
// EngineItem, ...) and just supply accessors.
export function SelectorList<T>({
  title,
  description,
  items,
  getId,
  getLabel,
  getBadge,
  isSelected,
  onToggle,
  selectedCount,
  isLoading,
  emptyText,
}: SelectorListProps<T>) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold leading-none">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {typeof selectedCount === "number" ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
        ) : null}
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const id = getId(item);
              const checked = isSelected(item);
              const badge = getBadge?.(item);
              return (
                <li key={id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent",
                      checked && "bg-accent/60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => onToggle(item)}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {getLabel(item)}
                    </span>
                    {badge ? (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {badge}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
