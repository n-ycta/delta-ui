import { ExistingWidget } from "./workbench/ExistingWidget";
import { PluginApp } from "./pages/plugins/PluginApp";
import { CapabilityGate } from "./ui/Dependencies";
import { Route, Routes } from "react-router-dom";
import {
  HomePage,
  HomeHeading,
  HomeSummary,
  HomeDashboard,
} from "./pages/Home";
import { DashboardsPage } from "./pages/Dashboards";
import { DashboardPage } from "./pages/DashboardPage";
import { PluginsPage } from "./pages/plugins/PluginsPage";
import { PluginDetail } from "./pages/plugins/PluginDetail";
import { NodesPage } from "./pages/nodes/NodesPage";
import { NodeDetail } from "./pages/nodes/NodeDetail";
import { EventsPage } from "./pages/EventsPage";
import { ContractsPage } from "./pages/contracts/ContractsPage";
import { AccessPage } from "./pages/AccessPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFound } from "./pages/NotFound";

import { McpPage } from "./pages/McpPage";
import { IdentityPage } from "./pages/IdentityPage";
export function ConsoleRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/fragments/heading"
        element={
          <div className="page">
            <HomeHeading />
          </div>
        }
      />
      <Route
        path="/fragments/summary"
        element={
          <div className="page">
            <HomeSummary />
          </div>
        }
      />
      <Route
        path="/fragments/dashboard"
        element={
          <div className="page">
            <HomeDashboard />
          </div>
        }
      />
      <Route path="/dashboards" element={<DashboardsPage />} />
      <Route
        path="/dashboards/:id/widgets/:widgetId"
        element={<ExistingWidget />}
      />
      <Route path="/dashboards/:id" element={<DashboardPage />} />
      <Route path="/plugins" element={<PluginsPage />} />
      <Route path="/apps/:id" element={<PluginApp />} />
      <Route path="/plugins/:id" element={<PluginDetail />} />
      <Route path="/nodes" element={<NodesPage />} />
      <Route path="/nodes/:id" element={<NodeDetail />} />
      <Route
        path="/events"
        element={
          <CapabilityGate capability="web.events_list">
            <EventsPage />
          </CapabilityGate>
        }
      />
      <Route path="/contracts" element={<ContractsPage />} />
      <Route
        path="/mcp"
        element={
          <CapabilityGate capability="web.mcp_list">
            <McpPage />
          </CapabilityGate>
        }
      />
      <Route path="/identity" element={<IdentityPage />} />
      <Route path="/access" element={<AccessPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
