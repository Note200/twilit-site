# tools/vendor

这里放的是**构建期**用到的第三方数据，运行时不加载（站点只发布生成的 `_data/world.js`）。

## countries-110m.json

- 来源：[world-atlas](https://github.com/topojson/world-atlas) 的 `countries-110m.json`（经 jsDelivr 取得）
- 上游数据：[Natural Earth](https://www.naturalearthdata.com/) 1:110m 国界（**公有领域**）
- world-atlas 打包代码许可：ISC
- 用途：`python tools/build_world_data.py tools/vendor/countries-110m.json`
  生成 `_data/world.js`（等距圆柱投影用的简化轮廓，284 环 / 7867 点 / 82KB）

### 想换精度

- 更细：改用 `countries-50m.json`（约 700KB → 生成后约 400KB，个人站不建议）
- 更粗：`land-110m.json`（约 55KB，只有陆地轮廓、没有国界）

替换后重新跑一次构建脚本即可，格式完全一致。
