import { createSlice } from "@reduxjs/toolkit";
const initialState = {
  incident: {
    title: "",
    batch_number: "",
    product_name: "",
    incident_date: "",
    department: "",
    severity: "Medium",
    status: "Draft",
    incident_description: "",
    containment_action: "",
    investigation_method: "5 Whys",
  },
  analysis: null,
  loading: false,
  error: "",
  savedId: null,
};
const slice = createSlice({
  name: "investigation",
  initialState,
  reducers: {
    updateField(s, a) {
      s.incident[a.payload.name] = a.payload.value;
    },
    setIncident(s, a) {
      s.incident = { ...s.incident, ...a.payload };
    },
    setAnalysis(s, a) {
      s.analysis = a.payload;
    },
    updateAnalysis(s, a) {
      s.analysis = { ...s.analysis, ...a.payload };
    },
    setLoading(s, a) {
      s.loading = a.payload;
    },
    setError(s, a) {
      s.error = a.payload;
    },
    setSavedId(s, a) {
      s.savedId = a.payload;
    },
    reset() {
      return initialState;
    },
  },
});
export const {
  updateField,
  setIncident,
  setAnalysis,
  updateAnalysis,
  setLoading,
  setError,
  setSavedId,
  reset,
} = slice.actions;
export default slice.reducer;
