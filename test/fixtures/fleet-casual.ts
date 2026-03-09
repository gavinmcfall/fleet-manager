/**
 * Casual persona — 5 ships, starter fleet with mixed insurance types.
 */
import { makeEntry, INSURANCE } from "./personas";
import type { HangarXplorEntry } from "./personas";

const fleet: HangarXplorEntry[] = [
  makeEntry({
    ship_code: "RSI_Aurora_MR",
    manufacturer_code: "RSI",
    manufacturer_name: "Roberts Space Industries",
    name: "Aurora MR",
    insurance: INSURANCE["6_MONTH"],
    pledge_date: "November 19, 2023",
    pledge_cost: "$45.00 USD",
    pledge_name: "Aurora MR Starter Pack",
  }),
  makeEntry({
    ship_code: "AEGS_Gladius",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Gladius",
    lti: true,
    warbond: true,
    pledge_date: "June 15, 2022",
    pledge_cost: "$90.00 USD",
    pledge_name: "Gladius LTI Warbond",
  }),
  makeEntry({
    ship_code: "DRAK_Cutlass_Black",
    manufacturer_code: "DRAK",
    manufacturer_name: "Drake Interplanetary",
    name: "Cutlass Black",
    insurance: INSURANCE["120_MONTH"],
    pledge_date: "December 01, 2023",
    pledge_cost: "$100.00 USD",
  }),
  makeEntry({
    ship_code: "MISC_Prospector",
    manufacturer_code: "MISC",
    manufacturer_name: "Musashi Industrial & Starflight Concern",
    name: "Prospector",
    insurance: INSURANCE["72_MONTH"],
    pledge_date: "March 10, 2024",
    pledge_cost: "$155.00 USD",
  }),
  makeEntry({
    ship_code: "GRIN_PTV",
    manufacturer_code: "GRIN",
    manufacturer_name: "Greycat Industrial",
    name: "PTV",
    insurance: INSURANCE.STANDARD,
    pledge_date: "January 05, 2024",
    pledge_cost: "$0.00 USD",
    entity_type: "vehicle",
    pledge_name: "Add-Ons - PTV Buggy",
  }),
];

export default fleet;
