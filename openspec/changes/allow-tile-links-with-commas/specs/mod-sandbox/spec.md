# Spec Delta

## MODIFIED Requirements

### Requirement: A tile link allows only the linked file
Each linked file SHALL be allowed by its address without query and fragment, and SHALL NOT allow any other file of its host. A path with `,`, `;`, `[`, `]` or `|` SHALL be allowed too, with each written as `%2C`, `%3B`, `%5B`, `%5D` and `%7C` in the policy, so the file loads at the address the tile wrote and no other file of its host does. A URL whose path ends with `/` names a folder or a page: it SHALL allow nothing and SHALL NOT be reported.

#### Scenario: Other file of the same host
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/covers/kallocain.jpg"`, and shows `https://media.example.net/covers/other.jpg`
- **THEN** the request is blocked before it is sent
- **AND** a warning issue is reported that names `https://media.example.net`

#### Scenario: Link to a folder
- **WHEN** a mod is opened with a tile that has `homepage: "https://media.example.net/covers/"`, and shows `https://media.example.net/covers/kallocain.jpg`
- **THEN** the request is blocked before it is sent
- **AND** no issue names the tile

#### Scenario: Comma in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/covers/chronicles,_volume_1.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Brackets and vertical bar in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/a[1]|b.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Other file next to a link with a comma
- **WHEN** a mod is opened with a tile that has `image: "https://media.example.net/covers/chronicles,_volume_1.jpg"`, and shows `https://media.example.net/covers/chronicles.jpg`
- **THEN** the request is blocked before it is sent

### Requirement: Tile links the sandbox cannot express
A linked URL that a sandbox policy cannot express SHALL allow nothing: one with a user name or password, an IPv6 address as host, a host name with a character other than letters, digits, `-` and `.`, or a path character other than letters, digits and `-._~!$&'()*+=:@%/,;[]|`. Each SHALL be reported once per tile as a warning issue whose source is the tile, naming the URL and saying that the sandbox cannot allow this address.

#### Scenario: Link with a password
- **WHEN** a mod is opened with the tile `https://tiles.example.net/books/kallocain.md` that has `image: "https://user:secret@media.example.net/cover.jpg"`
- **THEN** a warning issue whose source is `https://tiles.example.net/books/kallocain.md` names the URL and says that the sandbox cannot allow this address

#### Scenario: Link with an IPv6 address
- **WHEN** a mod is opened with a tile that has `image: "https://[2001:db8::1]/cover.jpg"`
- **THEN** a warning issue whose source is the tile says that the sandbox cannot allow this address

#### Scenario: Semicolon in the path
- **WHEN** a mod without permissions is opened with a tile that has `image: "https://media.example.net/a;b.jpg"`, and shows that URL
- **THEN** the image loads
- **AND** no issue names the tile

#### Scenario: Same link twice in one tile
- **WHEN** a mod is opened with a tile that has `image` and `thumbnail` both set to `"https://[2001:db8::1]/cover.jpg"`
- **THEN** exactly one issue names that URL
