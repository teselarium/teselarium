---
schema:
  definitions:
    book:
      properties:
        title:
          type: string
        date:
          type: string
        authors:
          elements:
            type: string
        country:
          type: string
        genres:
          elements:
            type: string
      optionalProperties:
        language:
          type: string
      additionalProperties: true
  ref: book
---

# Book Type

Type for defining a very simple book metadata.
