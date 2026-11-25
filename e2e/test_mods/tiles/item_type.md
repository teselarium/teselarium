---
schema:
  definitions:
    item:
      properties:
        title:
          type: string
      optionalProperties:
        image:
          type: string
      additionalProperties: true
  ref: item
---

# Item Type

An item of the tiles mod: a title and, optionally, the address of an image.
