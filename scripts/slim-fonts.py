"""Make the Recursive font files smaller by fixing the design axes the site never varies.

    pip install fonttools brotli && python3 scripts/slim-fonts.py

The site always sets Recursive to casual (CASL 1) with the default cursive setting (CRSV 0.5), and never uses its
real slant (the one italic, on the plain CV, is slanted by the browser). Fixing those three axes keeps weight and
mono and cuts the latin file from about 300 KB to about 90 KB. Run it again after scripts/fetch-fonts.py.
"""
import pathlib

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'fonts' / 'google'
PINNED = {'CASL': 1, 'CRSV': 0.5, 'slnt': 0}

for path in sorted(FONTS.glob('recursive-*.woff2')):
    font = TTFont(path)
    axes = {a.axisTag for a in font['fvar'].axes}
    if not axes & PINNED.keys():
        print(f'{path.name}: already slim')
        continue
    before = path.stat().st_size
    slim = instancer.instantiateVariableFont(font, {k: v for k, v in PINNED.items() if k in axes})
    slim.flavor = 'woff2'
    slim.save(path)
    print(f'{path.name}: {before // 1024} KB -> {path.stat().st_size // 1024} KB')
