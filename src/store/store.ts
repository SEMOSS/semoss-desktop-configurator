import { configureStore } from "@reduxjs/toolkit";
import mcpReducer from "./slices/mcpSlice";
import engineSlice from "./slices/engineSlice";

export const store = configureStore({
  reducer: {
    mcp: mcpReducer,
    engines: engineSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
