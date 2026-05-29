import { useInsight } from "@semoss/sdk/react";
import { useEffect, useMemo } from "react";
import { SelectorList } from "./SelectorList";
import { useRunPixel } from "@/lib/useRunPixel";
import {
  addSelectedMcp,
  callGetUserMcps,
  type MCPItem,
  removeSelectedMcp,
} from "@/store/slices/mcpSlice";
import { useAppDispatch, useAppSelector } from "@/store";

export const UserMCPs = () => {
  const { isReady } = useInsight();
  const dispatch = useAppDispatch();
  const runPixel = useRunPixel();
  const items = useAppSelector((state) => state.mcp.items);
  const isLoading = useAppSelector((state) => state.mcp.isLoading);
  const search = useAppSelector((state) => state.mcp.search);
  const selectedMcps = useAppSelector((state) => state.mcp.selectedMcps);

  const selectedIds = useMemo(
    () => new Set(selectedMcps.map((mcp) => mcp.id)),
    [selectedMcps],
  );

  // Query the user's MCPs once the insight is ready (initialized + authenticated).
  // Re-runs if the stored search term changes.
  useEffect(() => {
    if (!isReady) return;
    void dispatch(
      callGetUserMcps({
        runPixel,
        filterWord: search,
        offset: 0,
        append: false,
      }),
    );
  }, [isReady, search, runPixel, dispatch]);

  return (
    <SelectorList<MCPItem>
      title="MCPs"
      description="Select the MCPs to include."
      items={items}
      getId={(mcp) => mcp.id}
      getLabel={(mcp) => mcp.name}
      getBadge={(mcp) => mcp.type}
      isSelected={(mcp) => selectedIds.has(mcp.id)}
      onToggle={(mcp) =>
        dispatch(
          selectedIds.has(mcp.id)
            ? removeSelectedMcp(mcp.id)
            : addSelectedMcp(mcp),
        )
      }
      selectedCount={selectedMcps.length}
      isLoading={isLoading}
      emptyText="No MCPs found."
    />
  );
};
