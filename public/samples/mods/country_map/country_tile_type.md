---
schema:
  definitions:
    country_tile:
      properties:
        title:
          type: string
        country:
          type: string
      additionalProperties: true
  ref: country_tile
---

# Country Tile Type

Any tile with a string `title` and a string `country` is a country tile. Other
keys are allowed, and the card shows them as labeled values.

## Country names

A tile belongs to a country of the map when its `country`, trimmed, is the
country's name or one of its common names, ignoring case and accents. The map
is Natural Earth's 1:110m countries (`countries-110m.json` of `world-atlas`),
which writes some names short or formally, such as "United States of America",
"Czechia", "Côte d'Ivoire" or "Dem. Rep. Congo". Their common names also
match: "United States", "USA", "Czech Republic", "Ivory Coast", "DR Congo", and
so on. A country is shown with the `country` of its first tile, as written.

## Not on the map

A tile whose country matches no country of the map is listed under "Not on the
map": an empty or unknown name, a country too small for the 1:110m map, such
as Singapore, or a country that no longer exists, such as the Soviet Union. No
tile is left out.
