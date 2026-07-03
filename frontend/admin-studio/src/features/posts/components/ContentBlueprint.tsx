import React from 'react';
import { HelpCircle, Sparkles, Code, Table } from 'lucide-react';

interface ContentBlueprintProps {
  isProject: boolean;
}

export const ContentBlueprint: React.FC<ContentBlueprintProps> = ({ isProject }) => {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle size={18} className="text-primary" />
        <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
          {isProject ? 'Project Showcase Blueprint' : 'Article Blueprint'}
        </h3>
      </div>

      {/* Dynamic Structural Blueprints */}
      <div className="mb-4 space-y-3 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
          <Sparkles size={12} className="text-amber-500" /> Recommended Structure
        </div>
        {isProject ? (
          <ul className="list-disc list-inside space-y-1">
            <li><code className="text-primary font-mono font-bold">## 🚀 Overview</code> — Problem & solution overview</li>
            <li><code className="text-primary font-mono font-bold">## 🛠️ Built With</code> — Bulleted list of tools or stack</li>
            <li><code className="text-primary font-mono font-bold">## 🧠 Challenges</code> — Use <code className="font-mono">{'>'} blockquotes</code> for learnings</li>
          </ul>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            <li><code className="text-primary font-mono font-bold">## Introduction</code> — Hook the reader directly</li>
            <li><code className="text-primary font-mono font-bold">## Core Concepts</code> — Use H2/H3 elements for skimmability</li>
            <li><code className="text-primary font-mono font-bold">## Takeaways</code> — Summarize your ultimate conclusion</li>
          </ul>
        )}
      </div>

      <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

      {/* Advanced Syntax Reference */}
      <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
          Advanced Formatting
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Code size={14} className="mt-0.5 shrink-0 text-zinc-400" />
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Syntax Highlighting:</span>
              <p className="font-mono text-[11px] mt-0.5 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded inline-block">
                ```tsx{"\n"}const app = "node";{"\n"}```
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Table size={14} className="mt-0.5 shrink-0 text-zinc-400" />
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Data Tables:</span>
              <p className="font-mono text-[11px] mt-0.5 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded inline-block">
                | Metric | Value |{"\n"}|---|---|{"\n"}| Speed | 1.2s |
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};