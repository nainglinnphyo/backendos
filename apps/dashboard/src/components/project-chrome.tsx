"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeftIcon, HomeIcon, KeyIcon, PlusIcon, SettingsIcon, TableIcon } from "./icons";

interface ProjectChromeProps {
  projectId: string;
  projectName: string;
  tables: { name: string }[];
  children: ReactNode;
}

function useIsActive(href: string, exact = false) {
  const pathname = usePathname();
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function RailItem({ href, label, exact, children }: { href: string; label: string; exact?: boolean; children: ReactNode }) {
  const active = useIsActive(href, exact);
  return (
    <Link href={href} title={label} className={`icon-rail__item${active ? " active" : ""}`}>
      {children}
    </Link>
  );
}

export function ProjectChrome({ projectId, projectName, tables, children }: ProjectChromeProps) {
  const base = `/projects/${projectId}`;
  const pathname = usePathname();

  return (
    <div className="workspace">
      <div className="icon-rail">
        <Link href="/" className="brand-mark__logo" title="All projects">
          B
        </Link>
        <div className="icon-rail__nav">
          <RailItem href={base} exact label="Home">
            <HomeIcon />
          </RailItem>
          <RailItem href={`${base}/editor`} label="Table Editor">
            <TableIcon />
          </RailItem>
          <RailItem href={`${base}/api-keys`} label="API Keys">
            <KeyIcon />
          </RailItem>
          <RailItem href={`${base}/settings`} label="Settings">
            <SettingsIcon />
          </RailItem>
        </div>
      </div>

      <div className="section-sidebar">
        <div className="section-sidebar__header">
          <Link href="/" className="section-sidebar__back">
            <ArrowLeftIcon width={12} height={12} /> All projects
          </Link>
          <div className="section-sidebar__title">{projectName}</div>
        </div>
        <div className="section-sidebar__body">
          <div className="row" style={{ justifyContent: "space-between", padding: "0 8px", marginBottom: 4 }}>
            <span className="section-sidebar__label" style={{ padding: 0 }}>
              Tables
            </span>
            <Link href={`${base}/editor`} title="New table" className="icon-rail__item" style={{ width: 22, height: 22 }}>
              <PlusIcon width={13} height={13} />
            </Link>
          </div>
          {tables.length === 0 ? (
            <div style={{ padding: "4px 8px", fontSize: 12.5 }} className="muted">
              No tables yet
            </div>
          ) : (
            tables.map((t) => {
              const href = `${base}/editor/${t.name}`;
              const active = pathname === href;
              return (
                <Link key={t.name} href={href} className={`section-sidebar__link${active ? " active" : ""}`}>
                  <TableIcon width={14} height={14} />
                  <span className="mono">{t.name}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <main className="main">{children}</main>
    </div>
  );
}
