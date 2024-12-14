# rdaptastic

![GitHub repo size](https://img.shields.io/github/repo-size/berrysauce/rdaptastic)
[![CodeQL](https://github.com/berrysauce/rdaptastic/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/berrysauce/rdaptastic/actions/workflows/github-code-scanning/codeql)

rdaptastic is a modern lookup tool that uses the Registration Data Access Protocol (RDAP), the successor to WHOIS. It provides a clean summary of a domain's registry information, tracks historical changes, and can notify you of updates when something changes.

> [!WARNING]
> This project is still under active development. It may be unstable, deliver inaccurate data, or exhibit unreliable behavior. At this stage, self-hosting or contributing is not recommended. Stay tuned for updates!

<img alt="RDAPtastic Screenshot" src="https://share.berrysauce.dev/CleanShot-2024-12-14-at-21.33.53-F6qGy.png#e07425c36b347a4818407620dd12bddb86496526e222e1ef38ab678e057c386e">

## 🌐 How does it work?

RDAPtastic leverages the Registration Data Access Protocol (RDAP) to fetch detailed information about a domain, such as:

- Registrar details
- Domain age
- Nameservers
- Other critical information

RDAP is the modern replacement for the widely used WHOIS protocol, offering a more structured and standardized way to access domain data.

In addition to querying domain registries via RDAP, this tool integrates:

- ICANN's RDAP database to identify the appropriate RDAP service for each TLD.
- Cloudflare DNS and IPInfo APIs for ASN lookups and related data.

### Objective
The goal of rdaptastic is to not only perform RDAP lookups but also to organize and present the data in a user-friendly way. The result is a comprehensive overview of a domain's health, status, and other relevant metrics.

## 🛠 How Does It Work?

rdaptastic is composed of two main components:

`rdaptastic/web`
The web-based frontend, built with SvelteKit (5+).

`rdaptastic/api`
The API backend, built with the lightweight Hono framework.

### Hosting and Security
Both components are currently hosted using Cloudflare Pages and Cloudflare Workers. For added security, Cloudflare Turnstile is employed to protect against abuse.

## License

    Copyright (C) 2024 Paul Haedrich (berrysauce)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
