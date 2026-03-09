/**
 * Admin persona — 3 ships, minimal fleet for admin access control testing.
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
    pledge_date: "January 15, 2024",
    pledge_cost: "$45.00 USD",
    pledge_name: "Aurora MR Starter Pack",
  }),
  makeEntry({
    ship_code: "AEGS_Gladius",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Gladius",
    lti: true,
    pledge_date: "February 20, 2024",
    pledge_cost: "$90.00 USD",
  }),
  makeEntry({
    ship_code: "ANVL_Carrack",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "Carrack",
    insurance: INSURANCE["120_MONTH"],
    warbond: true,
    pledge_date: "March 01, 2024",
    pledge_cost: "$500.00 USD",
  }),
];

export default fleet;
