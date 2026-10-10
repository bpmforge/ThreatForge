/**
 * Threat Catalog Stats API
 * Returns statistics about available threat databases.
 */
import { NextResponse } from "next/server";
import {
  getCWECount,
  getCWECategoryCounts,
} from "@/features/threat-catalog/data/cwe-database";
import { builtInStats } from "@/features/threat-catalog/data";
import {
  mitreAttackIndex,
  cweIndex,
  capecIndex,
} from "@/features/threat-catalog/data/external-indexes";

export async function GET() {
  try {
    const cweCount = getCWECount();
    const cweCategoryCounts = getCWECategoryCounts();

    const stats = {
      // Built-in curated threats
      builtIn: {
        total: builtInStats.total,
        bySource: builtInStats.bySource,
        byCategory: builtInStats.byCategory,
      },

      // Extended CWE database
      cwe: {
        total: cweCount,
        byCategory: cweCategoryCounts,
        lastUpdated: "2024-12-12",
        version: "4.14",
      },

      // External indexes (lightweight references)
      indexes: {
        mitreAttack: {
          total: mitreAttackIndex.length,
          lastUpdated: "2024-01-01",
          version: "14.1",
        },
        cweIndex: {
          total: cweIndex.length,
          lastUpdated: "2024-01-01",
          version: "4.14",
        },
        capec: {
          total: capecIndex.length,
          lastUpdated: "2024-01-01",
          version: "3.9",
        },
      },

      // Totals
      totalSearchable: cweCount + builtInStats.total,
      totalWithIndexes:
        cweCount +
        builtInStats.total +
        mitreAttackIndex.length +
        cweIndex.length +
        capecIndex.length,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get threat catalog stats:", error);
    return NextResponse.json(
      { error: "Failed to retrieve stats" },
      { status: 500 },
    );
  }
}
