# ARMORY — M4A1 workbench

An interactive Three.js exterior customization prototype with a dark photographic environment, model-anchored component callouts, eight visual categories, camera controls, concept presets, undo/redo, local saved appearances, and PNG/JSON export.

## Run on a computer

Install Node.js 22.13 or newer. Open **Start Armory.cmd** on Windows, or run:

    npm ci
    npm run dev

Open the local address shown by the development server. Keep that terminal running while using the application. The development server normally uses port 3000.

No GitHub connection, Blender installation, application API keys, or paid model downloads are required for this version.

## Current fidelity and scope

This is an original, artist-authored approximation of an M4A1 exterior. It is not a 1:1 model, a licensed Colt asset, or a copy of Tarkov assets. Component labels describe original visual concepts. No real-world compatibility, component purchasing, functioning internals, or firing simulation is included.

The user's Tarkov screenshot guided the dark inspection stage and anchored callouts. Reaching that reference's detailed visual realism remains an asset-production task: source or author higher-quality separate meshes, consistent PBR textures, and inspect them in Blender before integrating them.

The starter platform is M4A1 only. An exact second AK variant remains a later milestone.

## Main files

- components/workbench.tsx: controls and appearance management.
- components/viewer.tsx: Three.js rendering, picking, callouts, thumbnails, camera and resource lifecycle.
- lib/m4-display-model.ts: original exterior geometry.
- lib/catalogue.ts: visual category data and saved-appearance validation.
- app/globals.css: responsive interface styling.
- ASSET-CREDITS.md: environment provenance.

Saved appearances use local storage. They are specific to the browser and origin; a local-server collection does not automatically transfer to the hosted URL. Export JSON to retain a separate copy. JSON import is not included in this first version.

## Validation

Production build and TypeScript checking are supported with npm run build and npx tsc --noEmit.

The authored app files pass targeted linting. The supplied UI component library has pre-existing lint findings in unused components; full npm run lint reports those. Those vendored files have not been modified.

Geometry and catalogue checks cover every individual appearance option, finite vertex attributes, expected selectable groups, and malformed saved data. These checks are not visual validation or a measured frame-rate benchmark. Browser interaction testing has not been performed in this session.
