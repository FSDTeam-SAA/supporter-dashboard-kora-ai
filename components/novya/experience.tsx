"use client";
// Route map for the Support dashboard. Every screen lives under one catch-all route
// so the shell (sidebar/header/Kora) stays mounted while navigating.
import { AssistantPage } from "@/components/pages/assistant";
import { LearnPage } from "@/components/pages/learn";
import { CalendarPage, InboxPage } from "@/components/sp/communication-pages";
import { MediaPage } from "@/components/sp/media-pages";
import { OfficePage } from "@/components/sp/office-pages";
import { SettingsPage } from "@/components/sp/settings-pages";
import { OverviewPage } from "@/components/pages/overview";
import { TeamPage } from "@/components/pages/team";
import { SupportHubPage, WorkspaceOverview } from "@/components/pages/hub";
import { QueuePage, TasksPage, WorkflowsPage } from "@/components/pages/work";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, Empty } from "./ui";


export default function SupportExperience() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [root, section, id, ...more] = pathname.split("/").filter(Boolean);
  if (root === "dashboard") return <OverviewPage />;
  if (root === "learn") return <LearnPage parts={[section, id, ...more].filter(Boolean)} search={search} />;
  if (root === "tasks") return <TasksPage id={section} />;
  if (root === "queue") return <QueuePage id={section} />;
  if (root === "workflows") return <WorkflowsPage id={section} />;
  if (root === "workspace" && section === "support") return <SupportHubPage parts={[id, ...more].filter(Boolean)} search={search} />;
  if (root === "workspace" && !section) return <WorkspaceOverview />;
  if (root === "team") return <TeamPage parts={[section, id, ...more].filter(Boolean)} search={search} />;
  if (root === "inbox") return <InboxPage />;
  if (root === "calendar") return <CalendarPage />;
  if (root === "workspace" && section === "office") return <OfficePage section={id} id={more[0]} />;
  if (root === "workspace" && section === "media") return <MediaPage section={id} id={more[0]} detailTab={more[1]} />;
  if (root === "settings") {
    const map: Record<string, [string, boolean]> = { profile: ["", true], security: ["security", true], privacy: ["sessions", true], accessibility: ["accessibility", true], notifications: ["notifications", false], preferences: ["preferences", false], kora: ["kora", false] };
    const [sec, account] = map[section || ""] || ["", false];
    return <SettingsPage section={sec} account={account} />;
  }
  if (root === "assistant") return <AssistantPage section={section} id={id} search={search} />;
  return <Empty title="Page not found" description="Choose an available view from your sidebar." action={<Button href="/dashboard">Back to Overview</Button>} />;
}
