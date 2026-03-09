/**
 * Hoarder persona — 60 ships: 50x Aurora MR, 5x Gladius, 3x Cutlass Black,
 * 1x Carrack, 1x Idris-P. Tests duplicate handling and fleet table performance.
 */
import { makeEntry, INSURANCE } from "./personas";
import type { HangarXplorEntry } from "./personas";

const fleet: HangarXplorEntry[] = [];

// 50x Aurora MR — some with custom names
for (let i = 1; i <= 50; i++) {
  fleet.push(
    makeEntry({
      ship_code: "RSI_Aurora_MR",
      manufacturer_code: "RSI",
      manufacturer_name: "Roberts Space Industries",
      name: "Aurora MR",
      lti: i <= 30, // 60% LTI
      insurance: i > 30 ? INSURANCE["6_MONTH"] : undefined,
      warbond: i % 3 === 0,
      pledge_date: `January ${String(Math.min(i, 28)).padStart(2, "0")}, 2024`,
      pledge_cost: "$45.00 USD",
      pledge_name: "Aurora MR Starter Pack",
      ship_name: i <= 10 ? `Aurora Fleet ${i}` : undefined,
    }),
  );
}

// 5x Gladius
for (let i = 1; i <= 5; i++) {
  fleet.push(
    makeEntry({
      ship_code: "AEGS_Gladius",
      manufacturer_code: "AEGS",
      manufacturer_name: "Aegis Dynamics",
      name: "Gladius",
      lti: true,
      warbond: true,
      pledge_date: `February ${String(i * 5).padStart(2, "0")}, 2024`,
      pledge_cost: "$90.00 USD",
    }),
  );
}

// 3x Cutlass Black
for (let i = 1; i <= 3; i++) {
  fleet.push(
    makeEntry({
      ship_code: "DRAK_Cutlass_Black",
      manufacturer_code: "DRAK",
      manufacturer_name: "Drake Interplanetary",
      name: "Cutlass Black",
      insurance: INSURANCE["120_MONTH"],
      pledge_date: `March ${String(i * 10).padStart(2, "0")}, 2024`,
      pledge_cost: "$100.00 USD",
    }),
  );
}

// 1x Carrack
fleet.push(
  makeEntry({
    ship_code: "ANVL_Carrack",
    manufacturer_code: "ANVL",
    manufacturer_name: "Anvil Aerospace",
    name: "Carrack",
    lti: true,
    warbond: true,
    pledge_date: "November 24, 2017",
    pledge_cost: "$500.00 USD",
    ship_name: "The Hoarder's Pride",
  }),
);

// 1x Idris-P
fleet.push(
  makeEntry({
    ship_code: "AEGS_Idris_P",
    manufacturer_code: "AEGS",
    manufacturer_name: "Aegis Dynamics",
    name: "Idris-P",
    lti: true,
    pledge_date: "November 29, 2019",
    pledge_cost: "$1,500.00 USD",
  }),
);

export default fleet;
