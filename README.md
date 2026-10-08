# Blockbuster Video

A free, unofficial Stremio catalogue that jumps to a different year from 1985–2004 every Monday. Real IMDb titles and posters, one catalogue, ten selectable aisles.

## Use this update

Keep the GitHub repository named `rewind-video`. The existing asset address remains `https://momoneymoproblemo.github.io/rewind-video`.

Upload the extracted contents of this ZIP to that repository, including `docs` and `.github/workflows/update.yml`. Do not upload the ZIP itself. GitHub Pages should publish the `docs` folder on your main branch. This ZIP includes a real-data manifest, catalogues and summary for the current week, so the first page load has actual films.

Open your GitHub Pages page and choose **Install in Stremio**. If you already installed the old version, remove it from Stremio and reinstall from this page to refresh its catalogue definitions. The add-on identity and IMDb film IDs are retained.

In Stremio, select **Discover → Movies → Blockbuster Video**, then choose an aisle in the genre dropdown. The home screen has one Blockbuster Video row, showing Biggest Hits by default. Biggest Hits, Best of the Year, Action, Comedy, Drama, Horror, Sci-Fi & Fantasy, Thriller & Crime, Family & Animation and Romance are filters within that single catalogue.

The install page uses VHS clamshell styling around actual film posters. Its aisle tiles show lightweight VHS spines with real titles printed vertically. Selecting a film or aisle opens its Stremio deep link; support for these links depends on the device. Stremio controls its own in-app layout and poster presentation.

## Weekly restocking

The workflow is now in `.github/workflows/update.yml`, where GitHub Actions can run it. Enable Actions and allow workflows to write repository contents. It runs on the original Sunday 14:30 UTC schedule (early Monday in Melbourne); you can also use **Actions → Restock Blockbuster Video → Run workflow**. The original year-selection and film-ranking rules remain in use.

To build locally, use Node 18+ and run `npm run build`. The builder downloads IMDb's public title and ratings datasets. For local dataset copies, set `IMDB_DIR` to a directory containing `title.basics.tsv.gz` and `title.ratings.tsv.gz`. The optional `YEAR` setting selects a year from 1985–2004.

If the repository name or account changes, update `BASE` in `build.js` before rebuilding. Static JSON paths support the single catalogue's genre filters, including spaces and ampersands. The `.nojekyll` file ensures GitHub Pages serves the files directly.

## Design and assets

The supplied storefront photograph is used unchanged in `docs/storefront.webp`. Typography is self-hosted in `docs/fonts` so the design does not depend on Google Fonts at runtime. The page preserves real poster art, weekly year/date data, install links, clipboard copying and IMDb metadata.

Blockbuster Video logo source: https://worldvectorlogo.com/logo/blockbuster-video (presentation colours adjusted to match the requested blue and yellow design). Google Fonts families: Barlow, Barlow Condensed, Caveat, Courier Prime and VT323. These font families are distributed under the SIL Open Font License, https://openfontlicense.org/open-font-license-official-text/.

Stremio catalogue/filter protocol: https://stremio.github.io/stremio-addon-sdk/api/responses/manifest.html
Stremio deep links: https://stremio.github.io/stremio-addon-sdk/deep-links.html

Unofficial fan project. Not affiliated with Blockbuster, IMDb or Stremio. Film data from IMDb's public datasets. This add-on supplies catalogues, not streams.
