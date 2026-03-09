/**
 * Edge-case persona — 8 ships designed to exercise parsing edge cases
 * and boundary conditions in the import pipeline.
 */
import { makeEntry, INSURANCE } from "./personas";
import type { HangarXplorEntry } from "./personas";

const fleet: HangarXplorEntry[] = [
  // 1. Unidentified ship — has unidentified URL and unknown ship_code
  makeEntry({
    ship_code: "UNKN_Mystery_Ship",
    manufacturer_code: "UNKN",
    manufacturer_name: "Unknown",
    name: "Mystery Ship",
    insurance: INSURANCE.STANDARD,
    pledge_date: "January 15, 2024",
    pledge_cost: "$200.00 USD",
    lookup: "mystery-ship",
    unidentified: "https://robertsspaceindustries.com/pledge/ships/mystery-ship",
  }),

  // 2. $0.00 USD pledge — promotional/VIP freebie
  makeEntry({
    ship_code: "RSI_Aurora_MR",
    manufacturer_code: "RSI",
    manufacturer_name: "Roberts Space Industries",
    name: "Aurora MR",
    insurance: INSURANCE["6_MONTH"],
    pledge_date: "December 25, 2023",
    pledge_cost: "$0.00 USD",
    pledge_name: "Promotional Holiday Gift",
  }),

  // 3. UEC purchase — in-game currency, not real money
  makeEntry({
    ship_code: "RSI_Aurora_LN",
    manufacturer_code: "RSI",
    manufacturer_name: "Roberts Space Industries",
    name: "Aurora LN",
    lti: false,
    insurance: INSURANCE.STANDARD,
    pledge_date: "February 10, 2024",
    pledge_cost: "\u00A415,000 UEC",
    pledge_name: "UEC Purchase",
  }),

  // 4. Missing insurance field entirely — no insurance key, lti: false
  {
    ship_code: "ANVL_Arrow",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "Arrow",
    lti: false,
    // insurance intentionally omitted
    warbond: false,
    pledge_id: "400004",
    pledge_name: "Standalone Ship - Arrow",
    pledge_date: "March 01, 2024",
    pledge_cost: "$75.00 USD",
    entity_type: "ship",
  },

  // 5. ship_name === ship_code — should NOT be treated as custom name
  makeEntry({
    ship_code: "AEGS_Gladius",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Gladius",
    lti: true,
    pledge_date: "April 10, 2024",
    pledge_cost: "$90.00 USD",
    ship_name: "Gladius", // same as display name, not custom
  }),

  // 6. Very long custom name — 80+ characters
  makeEntry({
    ship_code: "ANVL_Carrack",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "Carrack",
    lti: true,
    warbond: true,
    pledge_date: "November 24, 2020",
    pledge_cost: "$500.00 USD",
    ship_name:
      "The Most Magnificent Vessel To Ever Grace The Stanton System And Beyond The Stars Forever",
  }),

  // 7. Unusual pledge_date format — "1 January, 2020" vs typical "January 01, 2020"
  makeEntry({
    ship_code: "DRAK_Cutlass_Black",
    manufacturer_code: "DRAK",
    manufacturer_name: "Drake Interplanetary",
    name: "Cutlass Black",
    insurance: INSURANCE["72_MONTH"],
    pledge_date: "1 January, 2020",
    pledge_cost: "$100.00 USD",
  }),

  // 8. entity_type "vehicle" — PTV with non-ship entity type
  makeEntry({
    ship_code: "GRIN_PTV",
    manufacturer_code: "GRIN",
    manufacturer_name: "Greycat Industrial",
    name: "PTV",
    insurance: INSURANCE.STANDARD,
    pledge_date: "May 05, 2024",
    pledge_cost: "$15.00 USD",
    entity_type: "vehicle",
  }),
];

export default fleet;
