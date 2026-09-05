# Part-by-part material references

Checked September 5, 2026. The renderer assigns every one of the current **380 rendered material slots** (17 original, 40 sight/magnifier, 323 other accessory surfaces). This includes hidden original/variant choices so switching parts keeps the material treatment. [The generated coverage record](material-coverage.json) lists every mesh, original material name and assigned recipe. [surface-recipes.ts](../lib/surface-recipes.ts) holds the numeric settings.

Manufacturer sources establish material families and some texture features. They do not supply measured reflectance, roughness, coating thickness or exact color. The numbers and texture patterns below are artist interpretations, and the base artwork has no verified manufacturer identity. This is visual game-art rendering, not a materials specification for manufacturing.

## Original M4A1 artwork: all 17 groups

The [artist's CC0 model](https://opengameart.org/content/m4a1-assault-rifle) supplies a shared color/normal/metallic-roughness atlas. It does not identify every surface's alloy, resin or coating. Those maps remain authoritative for mixed surfaces inside a single mesh. The renderer preserves their metal mask instead of declaring an entire mixed mesh to be metal or polymer.

- Base, Charging_Handle, Sight and Sight_2: fine satin, anodized-style response over the original maps.
- Handguard: slightly rougher satin rail treatment, retaining the artwork's material variation.
- Stock and Pistol_Grip: fine molded-polymer surface treatment; authored metallic regions remain preserved.
- Magazine: a matte coated-metal interpretation, with the original atlas retaining any different regions. This does not identify it as a verified commercial magazine.
- Barrel, Front_Sight, Muzzle_Exterior, Ejector_Lid, Ejector_2, Switch1, Switch2, Firemode_Selector and Trigger: restrained dark coated-steel-style treatment over the original maps. Exact coatings are unverified; phosphate/nitride chemistry is not asserted.

Existing painted wear remains even on Fresh. No new heat, corrosion, firing deposits or internal mechanical effects are invented.

## Daniel Defense M4A1 RIS II FDE

The [manufacturer](https://danieldefense.com/m4a1-risii-fde.html) specifies 6061-T6 aluminum and Type III hard-coat anodizing in FDE or black. The finish therefore receives fine satin anodized shading, not ceramic-paint or rubber grain. Separate modeled hardware has a restrained dark-metal response. FDE color is an artistic bronze-brown interpretation; exact color and optical constants are unmeasured. The anodized shader is an effective PBR approximation rather than a solved multilayer oxide model.

## Magpul CTR

The [CTR page](https://magpul.com/ctr-carbine-stock-mil-spec.html) specifies a separate rubber buttpad; [Magpul's stock guide](https://magpul.com/ar-stocks) discusses its polymer materials. Exact resin composition is not established here. The cheek shell and frame use fine molded-polymer grain; the shoulder pad **and all ten pad ribs** use rubber. Modeled pivots, sling eyes and neck retain a distinct hardware treatment where represented. Their exact alloy/coating is inferred, not manufacturer-verified.

## Magpul MOE-K2

The [MOE-K2 page](https://magpul.com/moe-k2-grip-ar15-m4.html) identifies Trapezoidal Surface Projections and a ridged backstrap. The [K2+ page](https://magpul.com/moe-k2-plus-grip-ar15-m4.html) explicitly identifies rubber overmolding as a different variant. All fourteen K2 surfaces therefore remain hard polymer. The two dedicated textured panels receive an original approximate angular projection-height pattern; borders, upper body and modeled backstrap ridges retain smoother molding grain. The pattern is not a measured reproduction of Magpul's production tooling. Wear subtly polishes the high regions without exposing silver metal.

## Magpul PMAG 30 AR/M4 GEN M3

The [manufacturer](https://magpul.com/pmag-30-ar-m4-gen-m3.html) and [MAG557 information sheet](https://magpul.com/media/wysiwyg/GIS/MAG557_PMAG_30_AR_M4_GEN_M3_GIS_01.pdf) describe a polymer body, ribbed gripping surfaces, aggressive texture and dot-matrix identification panels. The modeled shell, ribs, floorplate and identification panels remain opaque polymer. Rib/floorplate roughness differs from the smoother side body. Unmarked identification dots share the body color rather than receiving invented bright paint. The shader does not add a window or pretend to reconstruct unmodeled production texture geometry.

## Magpul RVG

The [manufacturer](https://magpul.com/rvg-rail-vertical-grip.html) specifies high-strength polymer, aggressive texture and front/rear ridges. The body uses molded-polymer response with coarser inset/ridge regions. Existing modeled ridges remain the primary shape cue; highlights and abrasion stay nonmetallic.

## SureFire Warden Fast-Attach

The [manufacturer](https://www.surefire.com/warden/) identifies stainless-steel construction with Cerakote. The main shroud and lip receive a matte dielectric FDE coating; the collar/ridges get a darker coated-steel interpretation instead of inheriting aluminum shading from unrelated parts. The collar's exact separate coating formulation is unverified. Rare scuffs can reveal a steel-colored metallic substrate. The opaque front-depth graphic remains a protected dark recess, not rubber.

## SureFire M600U Scout Light

The [manufacturer](https://www.surefire.com/m600u-scout-light-weaponlight/) specifies aluminum with Mil-Spec hard anodizing and a tempered window. The body, flutes, head, heat-ring details, rim and tail shroud share a fine anodized response. They no longer inherit polymer or bare-hardware shading simply because those materials were reused during modeling. The switch surface remains rubber-like; the protective window gets a separate neutral optical material. The interior glint/depth graphic stays dark and protected. Although the product uses a TIR optical element, its material is not documented here and is not labeled as polymer.

## EOTECH EXPS3 + G33

The [EXPS3 manual](https://cdn.shopify.com/s/files/1/0698/3044/3191/files/EOTECH_HWS_Manual_EXPS3_XE1974_RevC.pdf?v=1754447701) identifies an aluminum protective hood, a glass front window, a laminate rear window and external anti-reflection coatings. It does not establish every housing/mount alloy or exact tan finish. The hood and housing artwork therefore use a fine satin tan-metal interpretation, with separate dark mount, hardware, rubber-control and recess profiles. Generic material-child names are resolved through their named parents so screw-slot graphics and mount seams do not become rubber parts. Markings and caution graphics retain their authored colors.

The [G-Series manual](https://cdn.shopify.com/s/files/1/0698/3044/3191/files/EOTECH_G-Series_Magnifier_Manual_R5FA.pdf?v=1754447761) confirms glass surfaces and anti-reflection coatings. An older manufacturer G33 manual describes a non-reflective rubber-coated finish; its legacy [source URL](https://www.eotechinc.com/media/wysiwyg/Product/Product_Manual/N1957_G33_User_Manual_Rev_B.pdf) was indexed but could not currently be opened. The user's product photos also guide the visible jacket. Jacket, ribs and jacket seam share a rougher tan-rubber interpretation; exposed rim/tube/mount artwork uses separate satin-metal profiles. Exact rubber formulation and every cap/inset material remain unverified.

EOTECH's [counterfeit-identification guidance](https://www.eotechinc.com/pages/help-center-counterfeit-detection) describes its flat windows as reflecting very little light. The HWS window consequently uses restrained nonmetallic reflection. G33 lenses add a very subtle view-dependent coating tint; the light window remains neutral. These are efficient physical-material/alpha surface effects, not calibrated coatings, optical magnification, refraction through the full lens stack or holography. Unmeasured IOR, opacity and tint values are artistic approximations.

## Rendering implementation and validation

The [rendering notes](material-rendering.md) explain the Three.js/Adobe/FPS research. Each recipe independently controls roughness, grain scale, micro-height, scratch strength, edge wear, polishing and exposed-substrate color. Geometry-bound sampling follows moving parts. Polymer and rubber remain dielectric. Numeric detail texture RGB is unchanged from the previous pass; alpha adds the K2 panel height and is never used as opacity. The versioned `surface-detail-v2.png` URL avoids serving the earlier RGB-only texture from browser caches.

Current checks require an explicit recipe for all 380 slots, correct rubber/metal assignment for the corrected regions, separate lenses with metallic response disabled, preserved mixed source atlases, protected markings, saved-condition compatibility and all 256 original/variant combinations. No browser visual comparison or measured material matching is claimed. The Blender master and thumbnail renders remain the earlier artwork; this pass changes the live Three.js materials.
