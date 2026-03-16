-- Production status corrections from Fleetyards API comparison (2026-03-17)
-- Aligns our statuses with community-maintained Fleetyards data.

-- → flight_ready (35 ships)
UPDATE vehicles SET production_status_id = 1
WHERE slug IN ('asgard-wikelo-war-special', 'atls', 'atls-geo', 'c1-spirit-wikelo-special', 'caterpillar-2949-best-in-show-edition', 'cutlass-black', 'cutlass-black-2949-best-in-show-edition', 'cutlass-red', 'eclipse', 'f8c-lightning-wikelo-sneak-special', 'f8c-lightning-wikelo-war-special', 'fortune-wikelo-special', 'golem-wikelo-work-special', 'guardian-mx-wikelo-war-special', 'guardian-qi-wikelo-special', 'hammerhead-2949-best-in-show-edition', 'idris-p-wikelo-war-special', 'intrepid-wikelo-work-special', 'l-21-wolf-wikelo-sneak-special', 'l-21-wolf-wikelo-war-special', 'meteor-wikelo-sneak-special', 'nox-wikelo-special', 'polaris', 'prospector-wikelo-work-special', 'prowler-utility-wikelo-work-special', 'raft-wikelo-work-special', 'reclaimer-2949-best-in-show-edition', 'sabre-firebird-wikelo-war-special', 'sabre-peregrine-wikelo-speedy-special', 'starlancer-max-wikelo-work-special', 'starlancer-tac-wikelo-war-special', 'terrapin-medic-wikelo-savior-special', 'valkyrie', 'zeus-mk-ii-cl', 'zeus-mk-ii-es-wikelo-work-special');

-- → in_concept (11 ships)
UPDATE vehicles SET production_status_id = 3
WHERE slug IN ('crucible', 'endeavor', 'g12', 'g12a', 'genesis', 'kraken', 'liberator', 'merchantman', 'nautilus', 'pioneer', 'vulcan');
