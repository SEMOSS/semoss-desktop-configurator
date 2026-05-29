import { useInsight } from "@semoss/sdk/react";
import { useEffect, useMemo } from "react";
import { SelectorList } from "./SelectorList";
import { useRunPixel } from "@/lib/useRunPixel";
import {
  addSelectedEngine,
  type EngineItem,
  fetchEnginesByType,
  removeSelectedEngine,
} from "@/store/slices/engineSlice";
import { useAppDispatch, useAppSelector } from "@/store";

export const ModelEngines = () => {
  const { isReady } = useInsight();
  const dispatch = useAppDispatch();
  const runPixel = useRunPixel();
  const items = useAppSelector((state) => state.engines.browse.MODEL.items);
  const isLoading = useAppSelector(
    (state) => state.engines.browse.MODEL.isLoading,
  );
  const search = useAppSelector((state) => state.engines.browse.MODEL.search);
  const selectedEngines = useAppSelector(
    (state) => state.engines.selectedEngines.MODEL,
  );

  const selectedIds = useMemo(
    () => new Set(selectedEngines.map((engine) => engine.id)),
    [selectedEngines],
  );

  // Query the user's MODEL engines once the insight is ready (initialized +
  // authenticated). Re-runs if the stored search term changes.
  useEffect(() => {
    if (!isReady) return;
    void dispatch(
      fetchEnginesByType({ type: "MODEL", runPixel, filterWord: search }),
    );
  }, [isReady, search, runPixel, dispatch]);

  return (
    <SelectorList<EngineItem>
      title="Model Engines"
      description="Select the model engines to include."
      items={items}
      getId={(engine) => engine.id}
      getLabel={(engine) => engine.name}
      getBadge={(engine) => engine.subtype || undefined}
      isSelected={(engine) => selectedIds.has(engine.id)}
      onToggle={(engine) =>
        dispatch(
          selectedIds.has(engine.id)
            ? removeSelectedEngine({ type: "MODEL", engineId: engine.id })
            : addSelectedEngine({ type: "MODEL", engine }),
        )
      }
      selectedCount={selectedEngines.length}
      isLoading={isLoading}
      emptyText="No model engines found."
    />
  );
};
