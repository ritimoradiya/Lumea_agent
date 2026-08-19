# Image generation prompts

Two shoots, two different style suffixes. Keeping each shoot internally
consistent matters far more than any single image being perfect — a set that
looks like one photographer beats a set of individually nicer but mismatched
images.

Free tools with usable quality: Bing Image Creator, Ideogram, Leonardo.

---

## Shoot 1 — Products

Append to **every** product prompt:

```
minimal editorial product photography, warm off-white seamless backdrop,
soft diffused daylight from the left, gentle shadow beneath, matte black cap,
blank cream paper label with no text, centred, medium format, 4:5
```

Say **"blank label, no text"** — image models produce garbled lettering
otherwise, and a blank label reads as deliberate.

| Save as | Prompt |
| --- | --- |
| `dissolve-balm` | squat wide glass jar of deep amber cleansing balm, matte black screw lid, 90ml |
| `clarity-cleanser` | tall olive-green glass pump bottle, black pump head, clear gel visible, 150ml |
| `dawn-vitamin-c` | small amber glass dropper bottle, black pipette cap, 30ml serum |
| `even-niacinamide` | small taupe-grey glass dropper bottle, black pipette cap, 30ml |
| `smooth-pha` | tall slate-green glass bottle, black cap, clear liquid toner, 150ml |
| `renew-retinol` | small dark amber glass dropper bottle, light-protective glass, black cap, 30ml |
| `quench-serum` | small smoke-blue glass dropper bottle, black pipette cap, 30ml |
| `shield-cream` | sage-green glass jar of thick white cream, matte black lid, 50ml |
| `recover-night` | near-black glass jar of rich cream, matte black lid, 50ml |
| `bright-eye` | very small pale bronze aluminium tube, black flip cap, 15ml |
| `daylight-spf` | frosted cream-white squeeze tube, black flip cap, 50ml sunscreen |
| `veil-tinted-spf` | soft beige squeeze tube, black flip cap, 40ml tinted sunscreen |

Save to `public/products/<id>.jpg`. The renderer picks a photo up
automatically and falls back to the drawing when one is absent, so they can be
added one at a time.

---

## Shoot 2 — Texture and atmosphere

Append to **every** prompt below:

```
editorial beauty photography, warm neutral palette, soft natural daylight,
shallow depth of field, no text, no logos, no packaging
```

### Texture macros — for the "How they feel" section

```
a smear of thick white cream on warm off-white stone, macro, soft daylight
a single drop of golden serum on a pale surface, extreme macro, soft focus
clear gel spread thin on frosted glass, tiny bubbles, macro, cool light
a bead of amber facial oil catching light, extreme macro, dark background
a swipe of mineral sunscreen on smooth grey stone, matte finish, macro
water droplets scattered on brushed steel, macro, cold morning light
thick cream peaked with a spatula, side lighting, macro, warm shadow
a serum drop mid-fall from a glass pipette, frozen motion, macro
```

### Ingredient close-ups — for an ingredients section

```
raw shea butter chunks on pale linen, macro, natural light
a single vitamin C crystal formation, extreme macro, clinical white
green tea leaves scattered on warm concrete, overhead, soft shadow
zinc oxide powder in a small glass dish, macro, cool daylight
oat kernels spilling from a paper sachet, macro, warm light
a glass beaker of clear liquid on a laboratory bench, soft daylight, minimal
```

### Skin — for the routine and hero sections

Generate these across **several skin tones**, not one. A skincare brand that
only shows one kind of skin looks like it was made carelessly.

```
close-up of a cheek with healthy glow, no makeup, soft daylight, macro
fingertips smoothing cream onto a jawline, natural skin texture, soft light
a face turned to the light, eyes closed, calm, natural skin, editorial
close-up of hands warming product between fingertips, soft daylight
bare shoulder and neck, natural skin texture, morning light, minimal
```

### Still life — for hero and section backgrounds

```
three unlabelled amber glass bottles grouped on a steel counter, soft daylight
a bathroom shelf in morning light, two bottles, a folded towel, minimal
an empty warm stone surface with soft window light, negative space, 16:9
a linen cloth draped beside a glass dropper, overhead, warm neutral tones
a single glass bottle casting a long shadow on cream plaster, low sun
```

---

## Practical notes

- **Aspect ratios.** Products 4:5. Texture macros square or 4:5. Backgrounds
  16:9.
- **Generate three of each** and keep the best. Hit rate is roughly one in
  three.
- **Reject anything with visible text.** Generated lettering is always subtly
  wrong and it is the first thing that gives an image away.
- **Watch consistency of light direction.** A set lit from the left throughout
  looks like a shoot; mixed directions looks like a search results page.
