"use client";

import { useSearchParams } from "next/navigation";
import { type ComponentProps, useEffect, useState } from "react";

import { AiTeamBuilder } from "@/components/tools/team/AiTeamBuilder";
import { ToolState } from "@/components/tools/ToolUi";
import { type TeamConfig, fromApiConfig } from "@/lib/ai-team";
import { type Overrides, lookupTeamConfiguration } from "@/lib/team-api";

type Props = Omit<ComponentProps<typeof AiTeamBuilder>, "initialConfig" | "initialOverrides" | "initialNotice">;
type Loaded = { status: "ready"; config: TeamConfig; overrides: Overrides } | { status: "failed" };

/**
 * Entry point of the configurator. A saved link (?c=<token>) is resolved through the API (the token
 * is sent in a POST body, never in an API URL) before the configurator renders with that configuration.
 */
export function AiTeamTool(props: Props) {
  const token = useSearchParams().get("c");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const content = props.content.save;

  useEffect(() => {
    if (!token) return;
    let active = true;
    lookupTeamConfiguration(token, props.locale).then((result) => {
      if (!active) return;
      const config = result.ok ? fromApiConfig(result.data.config) : null;
      setLoaded(config && result.ok ? { status: "ready", config, overrides: result.data.overrides ?? {} } : { status: "failed" });
    });
    return () => {
      active = false;
    };
  }, [token, props.locale]);

  if (!token) return <AiTeamBuilder {...props} />;
  if (!loaded) return <ToolState kind="loading" title={content.loading} />;
  if (loaded.status === "failed") {
    return (
      <div className="grid gap-8">
        <ToolState kind="error" title={content.loadError} />
        <AiTeamBuilder {...props} />
      </div>
    );
  }
  return <AiTeamBuilder {...props} initialConfig={loaded.config} initialOverrides={loaded.overrides} initialNotice={content.loaded} />;
}
