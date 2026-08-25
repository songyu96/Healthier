import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import HealthierApp from "./HealthierApp";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <HealthierApp />
    </HashRouter>
  </StrictMode>
);
