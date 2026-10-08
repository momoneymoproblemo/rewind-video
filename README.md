# Blockbuster Video

A free, unofficial Stremio catalogue that jumps to a different year from 1985–2004 every Monday. Real IMDb titles, one catalogue, ten selectable aisles and up to 25 films per aisle.

## Use this update

Keep the GitHub repository named `rewind-video`. The existing asset address remains `https://momoneymoproblemo.github.io/rewind-video`.

Upload the extracted contents of this ZIP to that repository, including `docs` and `.github/workflows/update.yml`. Do not upload the ZIP itself. GitHub Pages should publish the `docs` folder on your main branch. This ZIP includes a real-data manifest, catalogues and summary for the current week, so the first page load has actual films.

Open your GitHub Pages page and choose **Install in Stremio**. If you already installed the old version, remove it from Stremio and reinstall from this page to refresh its catalogue definitions. The add-on identity and IMDb film IDs are retained.

In Stremio, select **Discover → Movies → Blockbuster Video**, then choose an aisle in the genre dropdown. The home screen has one Blockbuster Video row, showing Most Rented by default. Unfiltered requests and Top/All compatibility filters always return Most Rented. The install page also has an explicit Open Most Rented link. Stremio can remember a previously selected filter; use this link or choose Most Rented in Discover to reset it. Most Rented, Best of the Year, Action, Comedy, Drama, Horror, Sci-Fi & Fantasy, Thriller & Crime, Family & Animation and Romance are filters within that single catalogue.

The install page uses classic white Blockbuster rental sleeves based on your cover references. Click, tap or press Enter/Space on a sleeve to flip it. The reverse shows real year, runtime and genres, plus director and cast when available. Use the reverse-side link to open the film in Stremio. The webpage omits the aisle grid; genre selection remains available inside Stremio. Stremio controls its own in-app layout and poster presentation.

## Weekly restocking

The workflow is now in `.github/workflows/update.yml`, where GitHub Actions can run it. Enable Actions and allow workflows to write repository contents. It runs on the original Sunday 14:30 UTC schedule (early Monday in Melbourne); you can also use **Actions → Restock Blockbuster Video → Run workflow**. The original year-selection and film-ranking rules remain in use, with the per-aisle limit raised from 20 to 25. Some genres have fewer than 25 qualifying films in a particular year; results are never padded with unrelated films.

To build locally, use Node 18+ and run `npm run build`. The builder downloads IMDb's public title and ratings datasets. For local dataset copies, set `IMDB_DIR` to a directory containing `title.basics.tsv.gz` and `title.ratings.tsv.gz`. The optional `YEAR` setting selects a year from 1985–2004.

If the repository name or account changes, update `BASE` in `build.js` before rebuilding. Static JSON paths support the single catalogue's genre filters, including spaces and ampersands. The `.nojekyll` file ensures GitHub Pages serves the files directly.

## Design and assets

The supplied interior photograph is used unchanged in `docs/store-interior.jpg`, with a subtle CSS blur behind the hero. The white page sections, solid blue shelves, slightly smaller logo and screenplay-style Courier Prime typography follow your updated references. Typography is self-hosted in `docs/fonts` so the design does not depend on Google Fonts at runtime. The page preserves weekly year/date data, install links, clipboard copying and IMDb metadata. Featured sleeve synopses, directors and cast are obtained from Stremio’s Cinemeta service at build time; the builder falls back to IMDb details if that service is unavailable. Stremio uses the original film posters from Metahub, preserving real IMDb film IDs. The custom rental sleeves remain on the webpage only. No poster renderer or generated poster files are required.

Blockbuster Video logo source: https://worldvectorlogo.com/logo/blockbuster-video (presentation colours adjusted to match the requested blue and yellow design). Vertical Blockbuster wordmark source: https://commons.wikimedia.org/wiki/File:Blockbuster_logo.svg.

Google Fonts families: Barlow, Barlow Condensed, Courier Prime and VT323 (SIL Open Font License), and Yellowtail (Apache License 2.0). Licence files are included in `docs/fonts`.

Stremio catalogue/filter protocol: https://stremio.github.io/stremio-addon-sdk/api/responses/manifest.html
Stremio deep links: https://stremio.github.io/stremio-addon-sdk/deep-links.html

Unofficial fan project. Not affiliated with Blockbuster, IMDb or Stremio. Film data from IMDb's public datasets. This add-on supplies catalogues, not streams.

## Direct movie stream links

Every movie catalogue preview includes `behaviorHints.defaultVideoId` equal to its IMDb ID. This lets compatible Stremio clients open the stream list directly, rather than waiting for metadata providers to finish before guessing the video ID. The add-on remains catalogue-only; installed streaming add-ons provide playable files. Series must not use their parent IMDb ID as a default episode ID.

## Refreshing catalogue cards (1.3.3)

The catalogue ID is now `blockbuster-video-v2`, giving all catalogue responses a fresh address. This rules out reuse of older cards without the movie video-ID hint. After uploading, remove the existing Blockbuster add-on, quit Stremio completely, and reinstall from the webpage. This is a cache-isolation change, not confirmation that the underlying 30-second delay has been fixed.
