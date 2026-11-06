import { configureStore } from "@reduxjs/toolkit";
import investigationReducer from "./investigationSlice";
export const store = configureStore({
  reducer: { investigation: investigationReducer },
});
