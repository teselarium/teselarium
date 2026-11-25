# Teselarium

_Modular and reusable knowledge_

Bring your notes. Choose a visualization. Share the result with a link.

Teselarium runs as static files. No server, no account.

> Teselarium is in an early phase of its development (version 0.x) and some features are not ready yet. See [What works today](#what-works-today).
> Live demo: https://teselarium.com

## How it works

- **Tiles** are your notes. These are markdown files with frontmatter.
- **Tile Collections** are just lists of tiles in yaml format.
- **Mods** are ways to show them: a list, a bookshelf, an interactive map, flashcards. These are javascript plugins.
- **Mosaics** pair a mod with a tile collection. A simple yaml file and one link to share.

A mod says which fields it needs. Any tile that has them works with it. So the same notes can be shown in many ways, and one mod can show notes written by someone else.

A mosaic opens from a link: `#/run?mosaic=<address of the file>`. The tiles, the mod and the mosaic can each live on a different website.
Teselarium can also works locally importing files from your computer.

## Why

- **Plain files** Your knowledge stays in markdown. Nothing is locked in a database.
- **Plug and play visualizations.** Change how you look at your data easily.
- **Easy sharing.** Send a link, and the other person sees the same view.
- **Mods are not trusted.** Each mod runs in a closed sandbox. It talks to the app only through a small API, you can check its default permissions and you are asked before it reaches a new website.

## Made with AI in mind

- Markdown is easy for people and for AI to read, write and reformat.
- The mod API is small, so an AI can write a new mod for a new use. A mod can ship its own tests, so the result can be checked.
- The app is a static page, so it is easy to run and test anywhere.
- Sharing markdown files and plugins could let that work be reused instead of repeated. This could help to a more sustainable use of the AI instead of parsing the same web pages and creating the sames apps.

## What works today

- Open the sample mosaics.
- Browse mods, tiles and mosaics from the sidebar.
- Try other combinations: change the mod or the tiles from the bar above the view.
- Save a mosaic of your own in your browser, edit it, and export it.
- Add a mosaic from a link or from your files.

## Next steps

- Follow the guide: [Open, try and share a mosaic](public/pages/guides/open_try_and_share).

## Contributing

Issues and feedback are welcome.

Code contributions are closed for now, while the project takes shape.
