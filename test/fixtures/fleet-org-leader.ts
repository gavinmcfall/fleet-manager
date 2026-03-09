/**
 * Org-leader persona — 10 diverse ships (combat/cargo/exploration mix)
 * for org fleet aggregation and member management testing.
 */
import { makeEntry, INSURANCE } from "./personas";
import type { HangarXplorEntry } from "./personas";

const fleet: HangarXplorEntry[] = [
  // Combat
  makeEntry({
    ship_code: "AEGS_Gladius",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Gladius",
    lti: true,
    warbond: true,
    pledge_date: "June 15, 2020",
    pledge_cost: "$90.00 USD",
  }),
  makeEntry({
    ship_code: "ANVL_F7C_Hornet",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "F7C Hornet",
    insurance: INSURANCE["120_MONTH"],
    pledge_date: "November 20, 2019",
    pledge_cost: "$110.00 USD",
  }),
  makeEntry({
    ship_code: "AEGS_Hammerhead",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Hammerhead",
    lti: true,
    pledge_date: "November 24, 2018",
    pledge_cost: "$725.00 USD",
  }),

  // Cargo / hauling
  makeEntry({
    ship_code: "DRAK_Caterpillar",
    manufacturer_code: "DRAK",
    manufacturer_name: "Drake Interplanetary",
    name: "Caterpillar",
    insurance: INSURANCE["72_MONTH"],
    pledge_date: "November 26, 2017",
    pledge_cost: "$295.00 USD",
  }),
  makeEntry({
    ship_code: "CRUS_C2_Hercules",
    manufacturer_code: "CRUS",
    manufacturer_name: "Crusader Industries",
    name: "C2 Hercules Starlifter",
    lti: true,
    warbond: true,
    pledge_date: "November 30, 2020",
    pledge_cost: "$360.00 USD",
  }),

  // Exploration
  makeEntry({
    ship_code: "ANVL_Carrack",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "Carrack",
    lti: true,
    pledge_date: "November 24, 2017",
    pledge_cost: "$500.00 USD",
    ship_name: "Squadron Explorer",
  }),
  makeEntry({
    ship_code: "RSI_Constellation_Andromeda",
    manufacturer_code: "RSI",
    manufacturer_name: "Roberts Space Industries",
    name: "Constellation Andromeda",
    insurance: INSURANCE["120_MONTH"],
    pledge_date: "August 15, 2021",
    pledge_cost: "$225.00 USD",
  }),

  // Mining / industrial
  makeEntry({
    ship_code: "MISC_Prospector",
    manufacturer_code: "MISC",
    manufacturer_name: "Musashi Industrial & Starflight Concern",
    name: "Prospector",
    insurance: INSURANCE["6_MONTH"],
    pledge_date: "April 10, 2022",
    pledge_cost: "$155.00 USD",
  }),

  // Multi-role
  makeEntry({
    ship_code: "DRAK_Cutlass_Black",
    manufacturer_code: "DRAK",
    manufacturer_name: "Drake Interplanetary",
    name: "Cutlass Black",
    insurance: INSURANCE["3_MONTH"],
    pledge_date: "March 20, 2021",
    pledge_cost: "$100.00 USD",
  }),
  makeEntry({
    ship_code: "CRUS_Mercury_Star_Runner",
    manufacturer_code: "CRUS",
    manufacturer_name: "Crusader Industries",
    name: "Mercury Star Runner",
    lti: true,
    warbond: true,
    pledge_date: "November 25, 2022",
    pledge_cost: "$225.00 USD",
  }),
];

export default fleet;
