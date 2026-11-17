"use client";
import type { ReactNode } from "react";
import { PlusMenu } from "./kora";

/** Page heading used on every screen: eyebrow, title, description, optional scope chip and the "+" menu. */
export function PageHead({
  eyebrow,
  title,
  description,
  chip,
  actions,
  onCreate,
  createLabel,
  plus = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  chip?: ReactNode;
  actions?: ReactNode;
  onCreate?: () => void;
  createLabel?: string;
  plus?: boolean;
}) {
  return (
    <div className="nv-page-head">
      <div>
        {eyebrow && <div className="nv-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="nv-page-head-side">
        <div className="nv-page-head-actions">
          {actions}
          {plus && <PlusMenu onCreate={onCreate} createLabel={createLabel} />}
        </div>
        {chip && <span className="nv-scope-chip">{chip}</span>}
      </div>
    </div>
  );
}
