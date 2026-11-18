/**
 * Hand-captured copy of the headline market, taken from the live public API on
 * 2026-11-17 while building. Used only when Gemini is unreachable and nothing newer
 * is on disk, and labelled "snapshot" wherever it is shown.
 */
import type { GeminiEvent } from "./public";

export const SNAPSHOT_AT = Date.parse("2026-11-17T22:00:00Z");

export const SNAPSHOT_EVENTS: GeminiEvent[] = [
  {
    id: "snapshot-ark-tex",
    title: "Arkansas vs Texas",
    slug: "arkansas-vs-texas",
    ticker: "NCAAF-2611212030-ARK-TEX-M",
    type: "categorical",
    category: "Sports",
    status: "active",
    expiryDate: "2026-11-22T20:30:00Z",
    volume: "0",
    sportsMarket: { sport: "NCAAF", type: "moneyline" },
    contracts: [
      {
        id: "GEMI-NCAAF-2611212030-ARK-TEX-M-TEX",
        label: "Texas",
        abbreviatedName: "TEX",
        instrumentSymbol: "GEMI-NCAAF-2611212030-ARK-TEX-M-TEX",
        prices: { buy: { yes: "0.92", no: "0.09" }, sell: { yes: "0.91", no: "0.08" } },
        status: "active",
        marketState: "open",
        resolutionSide: null,
        expiryDate: "2026-11-22T20:30:00Z",
        sportsSide: "home",
      },
      {
        id: "GEMI-NCAAF-2611212030-ARK-TEX-M-ARK",
        label: "Arkansas",
        abbreviatedName: "ARK",
        instrumentSymbol: "GEMI-NCAAF-2611212030-ARK-TEX-M-ARK",
        prices: { buy: { yes: "0.09", no: "0.92" }, sell: { yes: "0.08", no: "0.91" } },
        status: "active",
        marketState: "open",
        resolutionSide: null,
        expiryDate: "2026-11-22T20:30:00Z",
        sportsSide: "away",
      },
    ],
  },
];
