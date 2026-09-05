# ARMORY — M4A1 workbench

[Open the workbench](https://boorussia.github.io/armory-m4a1/) · [GitHub repository](https://github.com/BooRussia/armory-m4a1)

An interactive Three.js M4A1 visual workbench with a black studio and translucent glass controls. The default showcase combines a Blender-refined CC0 artist model with eight swappable exterior accessory studies. Choose original or accessory shapes, apply finishes, flip the G33 magnifier aside, save appearances, and view an animated separated layout. Original M4A1 and Accessory showcase presets are below the viewer. The earlier customization prototype remains available in Concept studies.

Compact thumbnail slots connect to the model. Select a slot to open its attachment grid, or use All parts to browse the complete library. Category icons and search support larger catalogues; full product names appear on hover, keyboard focus, and in the selected-item details. On phones, the slots form a horizontal strip and the library opens above it. The current library has 14 rendered thumbnails and two empty-slot choices.

## GitHub Pages

The public repository keeps source on `main` and the validated static site on `gh-pages`. Pages publishes from the root of `gh-pages`. No server, account login, paid service, or application secrets are needed to use the builder.

Run `npm run build:pages` to export this repository's Pages site into `dist/pages`, then `npm run test:pages` to verify the exported references. The default URL prefix is `/armory-m4a1`; set `NEXT_PUBLIC_BASE_PATH` to a different single repository path, or an empty value for a root/custom-domain site. Publish the contents of `dist/pages` at the root of `gh-pages`. Source pushes alone do not rebuild that branch.

The existing local Sites preview is preserved when its local hosting manifest exists. Public clones work without that manifest. The Pages script includes a build-only workaround for pinned Vinext beta.5's unprefixed prerender requests and Windows CLI shutdown; it still requires a clean exit, a rendered homepage, and a real static entry before staging. This shim is not shipped to browsers.

The editable master is included at `art/m4a1-eight-variants-master.blend`, with textures and the studio environment packed.

## Run on a computer

Install Node.js 22.13 or newer. Open **Start Armory.cmd** on Windows, or run:

    npm ci
    npm run dev

Open the local address shown by the development server. Keep that terminal running while using the application. The development server normally uses port 3000.

No GitHub connection, Blender installation, application API keys, or paid model downloads are required for this version.

## Current fidelity and scope

The default asset refines M4A1 Assault Rifle by nisu / 3DModelsCC0, released under CC0 on OpenGameArt. The original 9,258-triangle artwork was cleaned and separated in Blender 4.5.9 LTS. The delivered web model contains 17 mesh groups and 15,607 triangles after edge modifiers. This is moderate-detail game art; exact proportions, branded part identities and Tarkov-level fidelity have not been verified. See ASSET-CREDITS.md for provenance.

Handguard, pistol grip, front sight and muzzle exterior were separated along complete source geometry. Stock, pistol grip, magazine and muzzle have refined edge highlights. Most small fastener marks in the base remain texture detail. The asset does not include every screw, functional internals or true mechanical operation.

The accessory library adds eight original Blender exterior studies: EOTECH HHS VIII TAN (EXPS3-0 + G33), Daniel Defense M4A1 RIS II FDE, Magpul CTR stock, MOE-K2 grip, PMAG 30 GEN M3, RVG, SureFire Warden, and M600U Scout Light. Manufacturer pages verify product names. The optic artwork uses the user's photos; the other accessory shapes interpret official text and familiar exterior cues because official gallery pixels were unavailable. They are approximate visual studies, not verified 1:1 replicas, manufacturer CAD, or confirmation of physical compatibility. The earlier generic Concept studies remain separately labeled.

Sources & fidelity contains six exact Tarkov Wiki game-item names with direct citations. These are a reference backlog for artwork, not identities assigned to the current mesh. Search-indexed names were checked September 4, 2026; direct wiki access was blocked. No current game values, mechanical behavior, real compatibility, purchasing or firing simulation is supplied.

Rendering preserves supplied UVs and PBR images. Decoded image pixels match the baseline exactly. Blender normal strength was reduced to 0.35 for a less coarse appearance; its original OpenGL/DirectX convention remains undocumented. Optional cosmetic coatings preserve surface texture while changing albedo, roughness and metallic response through Three.js shaders. Original finish retains the source colors beneath the new material detail layer. Settings offers Fresh, Used and Worn surface wear; Fresh removes added wear while retaining existing painted art. See [material rendering](docs/material-rendering.md) for the shader approach, and [part-by-part materials](docs/part-materials.md) for manufacturer evidence, all 380 surface assignments and their limits. Turntable and separated-layout transitions use elapsed time and respect reduced motion. The separated layout uses arbitrary art offsets, not real mechanical travel or an assembly sequence. Display scale is arbitrary.

The separately delivered m4a1-eight-variants-master.blend is the combined editable master with all original base groups, eight accessory groups, packed images and studio HDR. It can open on another computer without this workspace. It retains the G33 pivot, fixed mount, and separate detail meshes. Studio preview images are Blender renders, not screenshots of the browser renderer. The original m4a1-exterior.blend is also retained.

Accessory GLBs share the base artwork's coordinates and receive its display normalization once. Only the top-level accessory is reparented, preserving the magnifier hierarchy. Side flipping is a visual animation; the viewer does not simulate calibrated 1x/3x optics. Selecting RIS II hides the original handguard and front sight in the art composition. Selecting HHS VIII replaces the original rear sight artwork. These visibility choices are not real installation guidance. A failed accessory bundle restores source parts and displays a reload message while successful bundles remain usable.

The starter platform is M4A1 only. An exact second AK variant remains a later milestone.

## Main files

- components/workbench.tsx: controls and appearance management.
- components/viewer.tsx: Three.js rendering, picking, callouts, thumbnails, camera and resource lifecycle.
- components/asset-inspector.tsx: sourced mesh inspector and wiki reference panel.
- lib/gltf-model.ts: GLB loading, preserved materials, display normalization and cleanup.
- lib/model-assets.ts: asset provenance, exact mesh IDs and cited game references.
- lib/asset-materials.ts: material-specific PBR surface detail, coatings and wear.
- lib/asset-appearance.ts: sourced-model saved state and import/export validation.
- lib/display-layout.ts: reversible inspection spacing and visible-only fit bounds.
- lib/variant-catalogue.ts: eight accessory definitions, names, references, and preview paths.
- lib/asset-variants.ts: shared-coordinate accessory loading, visibility, and magnifier animation.
- public/assets/m4a1/hhs-viii.glb: sight and magnifier exterior art with preserved pivot.
- public/assets/m4a1/exterior-variants.glb: seven further accessory groups.
- public/assets/m4a1/m4a1-blender-v2.glb: current Blender-refined model and packed textures.
- public/assets/m4a1/m4a1.glb: retained original source conversion.
- lib/m4-display-model.ts: original concept exterior geometry.
- lib/catalogue.ts: visual category data and saved-appearance validation.
- app/globals.css: responsive interface styling.
- ASSET-CREDITS.md: model and environment provenance.

Saved appearances use local storage. They are specific to the browser and origin; a local-server collection does not automatically transfer to a hosted URL. Export JSON to retain a separate copy. Version 2 exports include variants, magnifier position, visibility, finishes and optional surface wear. Version 1 appearances still load with their original shapes. Camera position and temporary inspection spacing are display preferences. Undo and redo include accessory selection, magnifier position and surface wear.

## Validation

Run npm test for asset and saved-state checks, npm run build for the production build, and npx tsc --noEmit for TypeScript checking.

The authored app files pass targeted linting. The supplied UI component library has pre-existing lint findings in unused components; full npm run lint reports those. Those vendored files have not been modified.

Asset checks cover the 17 base mesh IDs, embedded textures, PBR color spaces, per-part shader uniforms, reversible layout transforms, visible-only framing, appearance import/export, malformed saved data and resource cleanup. Accessory checks cover all 256 original/variant combinations, stable grouped exports, a stationary G33 mount during flipping, preserved child transforms in separated view, hidden-parent filtering, glass/marking protection, v1 save compatibility, and partial-load fallback. Blender renders were visually reviewed and the combined master reopened to verify all seven packed images/HDR. These are not browser interaction testing or a measured frame-rate benchmark. Browser testing has not been performed in this session.
