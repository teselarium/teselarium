## ADDED Requirements

### Requirement: Wildcard hosts cover subdomains
A permission whose host is a wildcard host, such as `https://*.us.archive.org`, SHALL cover every origin with the same scheme and port whose host name ends with the wildcard's host name after one or more extra labels. It SHALL NOT cover the wildcard's host name itself. Granting it SHALL allow the requests of its category to every covered origin, and a blocked request to a covered origin SHALL be reported as for an exact host.

#### Scenario: Image from a subdomain of a granted wildcard host
- **WHEN** a mod served from the app's origin declares `show` for `https://*.us.archive.org` and shows an image from `https://ia800100.us.archive.org/cover.jpg`
- **THEN** the image loads

#### Scenario: Deeper subdomain
- **WHEN** a mod served from the app's origin declares `connect` for `https://*.example.net` and calls `fetch("https://a.b.example.net/data")`
- **THEN** the request is sent

#### Scenario: The wildcard's own host name is not covered
- **WHEN** a mod served from the app's origin declares `show` for `https://*.us.archive.org` and shows an image from `https://us.archive.org/cover.jpg`
- **THEN** the request is blocked before it is sent
- **AND** a warning issue is reported that names `https://us.archive.org` and says to add it to `permissions.show` in `mod_conf.yaml`

#### Scenario: Other scheme is not covered
- **WHEN** a mod served from the app's origin declares `show` for `https://*.example.net` and shows an image from `http://images.example.net/cover.jpg`
- **THEN** the request is blocked before it is sent

#### Scenario: Wildcard host declared but not granted
- **WHEN** a foreign mod that declares `show` for `https://*.us.archive.org` shows an image from `https://ia800100.us.archive.org/cover.jpg`
- **THEN** a warning issue is reported that names `https://ia800100.us.archive.org` and says that the declared permission was not granted
