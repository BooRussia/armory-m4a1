# Surface materials

The live Three.js renderer adds a material-specific detail layer over the existing glTF artwork. The [part-by-part reference](part-materials.md) documents all 380 material assignments and their manufacturer evidence. In Settings, **Surface wear** selects Fresh, Used (default), or Worn. This choice follows saved appearances, export/import, Undo and Redo. Fresh removes the new wear layer; wear already painted into the original artwork remains.

## Rendering approach

- Keep Three r185's standard GGX metallic/roughness lighting, environment filtering, original normal maps, AO, shadowing, ACES tone mapping, and sRGB output. Two rectangular studio lights provide broad highlights; the existing HDR provides surrounding reflections.
- Classify named materials before part-level fallbacks, distinguishing anodized metal, ceramic-style coatings, polymer, rubber and hardware. Preserve original atlas inputs on mixed source materials. Values are artist-tuned approximations, not measured product finishes.
- A deterministic 512px repeating linear-data texture packs grain height in red, sparse finite scratches in green, broad roughness variation in blue, and an original angular K2 grip-panel height pattern in alpha. Alpha is data, never transparency. Three projections use bind-pose positions and normals. This keeps detail scale consistent across the scene and prevents texture sliding when the G33 flips or parts separate.
- Identify actual convex mesh edges at load time. Weld coincident positions for adjacency, reject coplanar triangulation, concave edges, open/non-manifold boundaries and angles below 35 degrees. Up to six nearest segment-distance fields are propagated across connected coplanar faces and interpolated to localize wear without outlining their internal diagonals. This is a geometry heuristic, not a simulated history of use or a painted contact mask. Small rounded bevels can be missed.
- Coating loss changes base color, metalness and roughness together. Polymer/rubber have no metal substrate and show restrained abrasion and polishing. Glass, emissive details, protected markings and decals bypass the layer.
- Layer a shallow surface-gradient bump after authored normal maps. Mipmapped data and a pixel-footprint fade suppress unresolved grain; a small roughness allowance prevents fine detail becoming mirror-like at distance. This approximates filtering; it does not implement the full Call of Duty normal-distribution model.

The GLBs and editable Blender master are unchanged. These are live Three.js material effects, not baked into Blender or exported GLBs. Existing thumbnails remain asset renders and do not preview the selected wear. Display units are artistic, not manufacturing dimensions. Reflections use an HDR environment and area lights, not ray tracing or reflections between model parts. No measured optical/finish calibration is claimed.

## Sources

- [Adobe: The PBR Guide, Part 2](https://www.adobe.com/learn/substance-3d-designer/web/the-pbr-guide-part-2) — coordinated metal/roughness authoring, paint versus exposed metal and consistent texture scale.
- [Sledgehammer Games / Activision: Material Advances in Call of Duty: WWII, SIGGRAPH 2018](https://advances.realtimerendering.com/s2018/MaterialAdvancesInWWII-course_notes.pdf) — material distributions and filtering specular detail.
- [Three.js: MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) — standard material channels and environment response.
- [Three.js: Color Management](https://threejs.org/manual/en/color-management.html) — linear data versus sRGB color maps and output conversion.
- [Three r185: physical lighting shader](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js) — underlying BRDF and built-in geometric roughness.

## Maintenance

`lib/surface-recipes.ts` owns explicit part/material assignment and numeric recipes. `lib/asset-materials.ts` applies these recipes and shader hooks. `lib/surface-geometry.ts` creates the additional geometry attributes while preserving supplied normals and UVs. The viewer owns and disposes the shared detail texture; hover clones keep the shader callbacks and their live uniforms. The three texture lookups are shared across all added effects. Geometry is expanded per triangle for edge distances, trading vertex memory for camera-independent edge localization; this is not a measured frame-rate claim.

To regenerate numeric texture data, install Python with NumPy/Pillow and run `python scripts/generate-surface-data.py --output <scratch-directory>`, then run `python scripts/generate-grip-surface.py --source <scratch-directory>/surface-detail.png --output <second-scratch-directory>`. Copy its `armory-surface-detail.png` into `public/assets/materials/surface-detail-v2.png`. Diagnostic previews belong outside the published assets. The seed and channel statistics are deterministic.

Asset tests check material classification, original map retention, wear persistence and validation, convex-edge selection, stable bind-pose coordinates and all 256 variant combinations. Pages checks include the shared surface texture. Browser interaction and GPU image comparison are separate from these checks.

This pass also compiled fourteen expanded Three shader stages (textured/untextured standard, physical, K2 pattern, HWS glass, G33 glass and light-window materials, each vertex/fragment) through Blender's native shaderc library: zero errors/warnings. The offline SPIR-V compiler requires an ES 310 header and a compatibility alias for an unused Three helper. This checks syntax/types and interface resource counts, not a browser driver's ES 300 program linking or rendered pixels. The most demanding tested program uses seven vertex attributes and eleven varying locations, within WebGL2 minimums. The six-field edge limit was also checked on subdivided boxes around the current narrow wear band; wider wear would need a new continuity check.
