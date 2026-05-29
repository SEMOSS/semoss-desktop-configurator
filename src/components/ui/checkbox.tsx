import { CheckIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Self-contained checkbox: a visually-hidden native input (keeps full keyboard
// + label semantics) paired with a styled indicator driven by the controlled
// `checked` prop. Use inside a <label> so clicking the row toggles it.
const Checkbox = React.forwardRef<
	HTMLInputElement,
	Omit<React.ComponentProps<"input">, "type">
>(({ className, checked, ...props }, ref) => (
	<span className="relative inline-flex">
		<input
			ref={ref}
			type="checkbox"
			checked={checked}
			className="peer sr-only"
			{...props}
		/>
		<span
			aria-hidden="true"
			className={cn(
				"flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
				checked
					? "border-primary bg-primary text-primary-foreground"
					: "border-input",
				className,
			)}
		>
			<CheckIcon
				className={cn(
					"size-3.5 transition-opacity",
					checked ? "opacity-100" : "opacity-0",
				)}
			/>
		</span>
	</span>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
