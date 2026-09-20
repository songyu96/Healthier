# Swimmer asset

Derived from the MakeHuman project's CC0 hm08 base mesh, default skeleton and skin weights.

Source revision: a8bc2d54ff0ac92e78ff71431b1023eda42bf482
Source: https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data
License: CC0 1.0 Universal; see LICENSE.MakeHuman.md.

Changes: removed helper geometry, retained the four strongest skin influences, converted units to meters, added swimming-suit material regions and exported a self-contained GLB. Swimming poses and accessories are authored in this project. The prototype uses one base mesh for both selectable appearances.

To rebuild, download 3dobjs/base.obj, rigs/default.mhskel, rigs/default_weights.mhw from that revision, plus the root LICENSE.ASSETS.md. Write the revision to commit.txt alongside them, then run:

`node scripts/build-swimmer.mjs <source-directory>`

Source SHA-256:

```
base.obj: 8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c
default.mhskel: 99f179bce0aa850b45d4191a1d0d234c5851f881c057439470ded3bddf729a24
default_weights.mhw: 0f3641d651ae3d00ad6b4ccee43142edb109d3bd909d27d9e4139ef1beed8625
```
