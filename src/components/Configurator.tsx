import { ModelEngines } from "./ModelEngines";
import { UserMCPs } from "./UserMCPs";

// Main screen: title + the MCP and model-engine selectors side by side.
export const Configurator = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          SEMOSS AI Desktop Configurator
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the MCPs and model engines to include in your configuration.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <UserMCPs />
        <ModelEngines />
      </div>
    </div>
  );
};
