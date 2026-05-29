import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModelEngines } from "./ModelEngines";
import { UserMCPs } from "./UserMCPs";

// Main screen: title + the MCP and model-engine selectors side by side.
export const Configurator = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            SEMOSS AI Desktop Configurator
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose the MCPs and model engines to include in your configuration.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/ide">Local AI tools →</Link>
        </Button>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <UserMCPs />
        <ModelEngines />
      </div>
    </div>
  );
};
