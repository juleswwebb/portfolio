# Jules Webb — Engineering Portfolio

A static engineering portfolio for **https://juleswwebb.github.io/portfolio/**.

The site includes an editorial homepage, four standalone project case studies,
an interactive subsystem viewer, project filters, image detail dialogs, responsive
navigation and social sharing metadata. It uses plain HTML, CSS and JavaScript,
with locally hosted images and no runtime dependencies, trackers or external fonts.

## Preview

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. Run `python3 verify.py` to check local links, fragment
targets, images, headings and metadata. Run `node --check app.js` for JavaScript
syntax validation.

## Deploy

In this repository’s **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source. The workflow in `.github/workflows/pages.yml`
validates and deploys the public site files after a push to `main`. It can also
be run manually from the Actions tab.

Only the HTML pages, CSS, JavaScript, assets and crawler files are included in
the deployed artifact. The source does not contain the LinkedIn PDF, coursework
reports, firmware, engineering source repositories or private recordings.

## Update

- Edit `index.html` for the introduction, experience, contact links and project cards.
- Edit each project’s HTML for its case study and credits.
- Edit `styles.css` for the design; `app.js` controls progressive enhancements.
- Put optimised project images in `assets/`; update alt text and captions too.
- Update canonical URLs, `sitemap.xml`, `robots.txt`, the social-image URL and
  `404.html` if the repository name or hosting domain changes.

## Content provenance

Professional information and the LinkedIn URL were taken from the user-supplied
LinkedIn profile export dated 7 October 2026. No private analytics or unrelated
profile recommendations were used.

- **Line follower:** Group 13 project report, design figures and application images.
  Team members and reported results are credited in the case study.
- **RoboDev:** collaborative repository documentation and a 3D render made from
  its current KiCad signals board. Planned specifications are identified as such;
  the visualisation does not imply fabricated or validated hardware.
- **RoboCup:** project firmware/tooling documentation and an Arena View screenshot.
  Ongoing hardware validation and dead-reckoning limitations are stated.
- **Frame solver:** application documentation and generated analysis figures.
  Historical reference checks are described as documented development history.

Confirm specific individual contributions before changing the team descriptions
to first-person ownership claims. Update development status as projects progress.

## Interactive browser edition

Seven case studies now include the elevator PLC, CNC mechanical design and ENCE361 step counter. `structure-lab.html` runs a JavaScript port of the original Python direct-stiffness engine in a module worker. It supports axial trusses, Euler–Bernoulli / Timoshenko frames, end releases, rotated supports, nodal and member loads, drawing/editing, undo/redo, JSON sessions, force diagrams and worked matrix downloads. Internal units are SI; UI conversions are explicit. Deformation uses finite-element interpolation, and stress output is axial stress (bending and buckling checks are not included).

`node tests/fea-engine.test.mjs` checks analytical mechanics, stability failures, constrained-load reactions and frozen results generated from the original Python `frame_toolkit.Structure`. The Pages workflow runs these checks alongside the static-site verifier.

`design-library.html` uses a self-hosted Apache-licensed model-viewer (license included) to render actual GLB geometry. Models load on selection; rendered PCB views use optimized WebP previews and downloadable full PNGs. Camera presets, orbit/zoom, auto-rotation, studio background and view export are available. Download packs include actual available source CAD and renders. All original project workspaces remain untouched.

The shared Group 13 OneDrive folder contains files that are cloud placeholders and could not be opened during this export. Affected native archives are marked partial, omit unavailable files and contain `FILES-AWAITING-ONEDRIVE-SYNC.txt`. `assets/models/source-inventory.json` records inclusion status. Supplied STL/3MF exports provide mechanical browser geometry; SolidWorks source parts/assemblies remain native downloads. 3MF placements are print layouts, not reconstructed robot assemblies. Component-library STEP references are identified separately from custom PCB designs.

The elevator, CNC and step-counter web demos are labelled recreations/illustrations. They do not execute the physical controller firmware or claim measured hardware performance. Actual CNC and step-counter project photography is pending.

Motion uses native CSS, SVG and canvas, pauses expensive loops offscreen and honours reduced-motion preferences. No analytics or account/login is required. Locally saved structural models remain in the visitor's browser.

PCB GLB materials use the green default soldermask seen in the KiCad rendered previews. CAD geometry is retained; component materials are adjusted for readable browser lighting. Source STEP and KiCad exports remain available.
