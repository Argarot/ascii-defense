"""Reproducible base-design review. Exact runtime glyphs; no game assets modified.

Run from any directory with Python + Pillow. Candidate JSON is intentionally
kept below style-review/, outside the importer's production study glob.
"""
from pathlib import Path
import base64
import json
import math
import io
import html
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / 'previews'
OUT.mkdir(parents=True, exist_ok=True)
ATLAS = json.loads((ROOT/'packages/app/public/assets/glyphset-spleen.json').read_text(encoding='utf-8'))
BITS = base64.b64decode(ATLAS['bits'])
GLYPHS = {chr(cp): BITS[i*8:i*8+8] for i, cp in enumerate(ATLAS['codepoints'])}
GROUND = '#1c2733'
STYLES = [
 ('A', 'Field machinery', 'Exposed mechanisms, braced steel, practical engineering.'),
 ('B', 'Armoured citadel', 'Low bunkers, thick housings, protected mechanisms.'),
 ('C', 'Arcane instrument', 'Faceted vessels, ritual geometry, suspended energy.'),
 ('D', 'Atomic age', 'Rounded pressure vessels, antennae, laboratory hardware.'),
 ('E', 'Lattice construct', 'Open trusses, separated modules, lightweight frames.'),
 ('F', 'Ancient automaton', 'Carved bodies, articulated joints, inset living light.'),
]
RELIC_STYLES = [
 ('A', 'Pocket objects', 'Literal objects with a small living detail.'),
 ('B', 'Engraved seals', 'Compact square metal seals with coloured engraving.'),
 ('C', 'Runic charms', 'Open, angular glyphs suspended around a core.'),
 ('D', 'Glass capsules', 'Rounded vessels holding the relic effect.'),
 ('E', 'Miniature devices', 'Useful mechanisms rendered as tiny equipment.'),
 ('F', 'Cut gemstones', 'Faceted talismans with a bright internal symbol.'),
]
RELICS = {
 'relic_tithe': ('Tithe', '#f3ce67', [
  [' /\\ ','(o$)',' \\/ '], ['┌──┐','│o$│','└──┘'], [' \\| ','-o$-',' |/ '],
  [' __ ','(o$)','(__)'], ['┌o─┐','│$$│','└┬┬┘'], [' /\\ ','<o$>',' \\/ '],
 ]),
 'relic_frostbite': ('Frostbite', '#88dcf7', [
  [' \\|/','─o─ ',' /|\\'], ['┌──┐','│o*│','└──┘'], [' *  ','<o*>','  * '],
  [' __ ','(o*)','(__)'], ['┌┬┬┐','│o*│','└┴┴┘'], [' /\\ ','<o*>',' \\/ '],
 ]),
 'relic_orbital': ('Orbital Lance', '#eaa5e7', [
  ['\\o/ ','[|] ',' V  '], ['┌──┐','│oV│','└──┘'], [' /\\ ','-o- ',' \\/ '],
  [' __ ','(o|)','(_V)'], ['[o]=',' |  ',' V  '], [' /\\ ','<o|>',' \\/ '],
 ]),
}
# Each row is authored explicitly, never stretched, rotated, or font-substituted.
# Lowercase o / * / @ are the local animated indicator; housing stays anchored.
TOWERS = {
 'bolt': ('Bolt Turret', '#f2b85c', [
 ['  ┌─┐   ',' ┌┤o├==>',' └┬─┘   ','  ││    ',' /┴┴\\   '],
 ['        ',' /───\\  ','[ o ]==>',' ├───┤  ','/┴───┴\\ '],
 ['   /\\   ','  /o/==>','  \\/    ','  /│\\   ',' ─┴┴─   '],
 ['  _|_   ',' /o  )=>',' \\___/  ','   ||   ','  /__\\  '],
 [' ┌─┬┐   ',' │o╳├==>',' └─┼┘   ','  /│\\   ',' /_│_\\  '],
 ['  /─\\   ',' [o ]==>','  \\┬/   ','  /│\\   ',' _/ \\_  '],
 ]),
 'mortar': ('Mortar', '#f68e65', [
 ['    //  ','   //   ',' [o/ ]  ',' /┬──\\  ','/_┴___\\ '],
 ['   /==/ ','  /__/  ',' /o──\\  ','[─────] ',' ┴───┴  '],
 ['  \\  /  ','   \\/*  ','  /o \\  ','  \\__/  ',' ─┴──┴─ '],
 ['   /O/  ','  / /   ',' (o  )  ','  \\__/  ',' /_||_\\ '],
 ['    //  ',' ┌─//┐  ',' │o/ │  ',' /X─X\\  ','┴─────┴ '],
 ['   /O/  ','  /_/   ',' /o─\\   ','[|  |]  ',' /__\\   '],
 ]),
 'refinery': ('Refinery', '#e7cf65', [
 [' ┌─┐ |  ',' │o│/|  ',' ├─┤ |  ',' │V│[=] ','─┴─┴─┴─ '],
 ['  ┌──┐  ',' /│o │\\ ','[─┴──┴─]','│ [VV] │','┴──────┴'],
 ['   /\\   ','  /o \\  ','  \\  /  ','  /VV\\  ',' ─┴──┴─ '],
 ['  __    ',' /o \\ | ',' |==|_| ',' |VV|   ','/┴──┴\\  '],
 ['  /|\\   ',' /o| \\  ','/──┼──\\ ','  [V]   ',' _/ \\_  '],
 ['  /──\\  ',' /o┬─ \\ ',' │ │  │ ',' │ V  │ ','/┴────┴\\'],
 ]),
 'frost': ('Frost Emitter', '#80dcf3', [
 ['  \\|/   ',' ─[o]─  ','  /|\\   ','  ││    ',' /┴┴\\   '],
 ['   *    ',' /─┼─\\  ','[ o───] ',' ├───┤  ','/┴───┴\\ '],
 ['   /\\   ','  /o \\  ',' < || > ','  \\  /  ','   \\/   '],
 ['  ___   ',' / o \\  ','(  |  ) ',' \\___/  ','  /_\\   '],
 [' ┌─┬─┐  ',' │ o │  ','─┼─┼─┼─ ',' │ │ │  ',' ┴─┴─┴  '],
 ['   /\\   ','  [o]   ',' /┤ ├\\  ',' ││ ││  ','/┴┴─┴┴\\ '],
 ]),
 'tesla': ('Tesla Coil', '#ba9bf7', [
 ['  ─┬─   ','  (o)   ','  }|{   ','  }|{   ',' /_||_\\ '],
 [' ┌─o─┐  ',' └─┬─┘  ',' /─┼─\\  ','[=====] ',' ┴───┴  '],
 ['   /\\   ','  (o)   ',' < || > ','  \\||/  ','  /__\\  '],
 ['   _    ',' ( o )  ','  )|(   ',' (===)  ',' /___\\  '],
 ['  o──o  ','  │  │  ',' ├┼──┼┤ ','  │  │  ',' ─┴──┴─ '],
 ['  /o\\   ','  \\ /   ',' /}|{\\  ',' │}|{│  ','/┴───┴\\ '],
 ]),
 'missile': ('Missile Rack', '#e987a5', [
 [' /\\ /\\  ',' || ||  ','[oo───] ',' \\───/  ',' /┴─┴\\  '],
 [' /\\/\\/\\ ','[||||||]','[o─────]',' ├────┤ ','/┴────┴\\'],
 ['  /\\/\\  ','  ||||  ',' <o──>  ','  \\  /  ',' ─┴──┴─ '],
 ['  /\\    ',' (  )|  ',' (o )|  ',' /||\\|  ','/_||_\\  '],
 [' /\\  /\\ ',' ||  || ','─┼o──┼─ ',' /X──X\\ ','┴──────┴'],
 ['  /\\/\\  ',' /||||\\ ',' [o───] ',' /|  |\\ ','/_|__|_\\'],
 ]),
 'laser': ('Laser Lance', '#f07b74', [
 ['  ┌──┐  ',' [o==]=>','  └┬─┘  ','   ││   ','  /┴┴\\  '],
 ['        ',' /────\\ ','[o====]>',' ├────┤ ','/┴────┴\\'],
 ['   /\\   ','  <o>==>','   \\/   ','   ||   ','  /__\\  '],
 ['  _|_   ',' (o )==>',' (___)  ','   ||   ','  /__\\  '],
 [' ┌───┐  ',' │o──┼=>',' └─┼─┘  ','  /X\\   ',' ┴───┴  '],
 ['  /──\\  ',' [o||]=>','  \\──/  ','  /||\\  ',' /_||_\\ '],
 ]),
 'bastion': ('Bastion', '#80d5ae', [
 ['  |┌─┐  ','  |└─┘  ',' [o──]  ',' /│  │\\ ','/─┴──┴─\\'],
 [' ┌┐┌┐┌┐ ',' │└┘└┘│ ',' │ o  │ ',' │┌──┐│ ','─┴┴──┴┴─'],
 ['   /\\   ','  /o \\  ',' /─┼──\\ ','  \\  /  ',' ─┴──┴─ '],
 ['  \\|/   ',' ( o )  ','  |==|  ',' /|  |\\ ','/─┴──┴─\\'],
 ['  ┌o┐   ',' ┌┼─┼┐  ',' ││ ││  ','/X│ │X\\ ','┴─┴─┴─┴ '],
 ['  /──\\  ',' │ o  │ ','/│┌──┐│\\',' ││  ││ ','─┴┴──┴┴─'],
 ]),
}
# x is used for the lattice intersection: only the atlas's light lines exist.
for _, _, variants in TOWERS.values():
 for art in variants:
  for y, row in enumerate(art): art[y] = row.replace('╳', 'X')

def rgb(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
def mix(a,b,t): return tuple(round(x*(1-t)+y*t) for x,y in zip(rgb(a),rgb(b)))
def hx(c): return '#'+''.join(f'{v:02x}' for v in c)
def font(size):
 return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',size)

def render(frame, palette, cell, bg=GROUND):
 im=Image.new('RGB',(cell[0]*5,cell[1]*8),bg)
 for y,row in enumerate(frame['art']):
  for x,ch in enumerate(row):
   key=frame['ink'][y][x]
   if ch==' ' or key=='.': continue
   if 'bg' in frame and frame['bg'][y][x]!='.':
    ImageDraw.Draw(im).rectangle((x*5,y*8,x*5+4,y*8+7),fill=palette[frame['bg'][y][x]])
   for gy,byte in enumerate(GLYPHS[ch]):
    for gx in range(5):
     if byte & (1<<(7-gx)): im.putpixel((x*5+gx,y*8+gy),rgb(palette[key]))
 return im

def candidate(asset,name,accent,art,style,cell=(8,5)):
 assert len(art)==cell[1], (asset,style,'height')
 assert all(len(r)==cell[0] for r in art), (asset,style,[(r,len(r)) for r in art])
 assert all(ch in GLYPHS and (ch==' ' or any(GLYPHS[ch])) for r in art for ch in r), (asset,style,'glyph')
 # Style-specific materials. Hue identity remains the same within a tower.
 materials=[('#b8c7d0','#728797'),('#9aafb9','#738997'),('#dad2e8','#9a90b3'),('#e2d8c4','#9caaa7'),('#a9c7ca','#73969e'),('#bdb9ac','#8a948c')]
 hi,lo=materials[style]
 pal={'h':hx(mix(hi,accent,.28)),'s':hx(mix(lo,accent,.18)),'a':accent,'d':hx(mix(accent,GROUND,.77))}
 for f in range(5):
  # A sampled cosine gives a continuous wrap: no full-body flashes.
  pal[str(f)]=hx(mix(accent,'#ffffff',.04+.46*(1-math.cos(2*math.pi*(f+.17)/5))/2))
 active=[(x,y) for y,r in enumerate(art) for x,ch in enumerate(r) if ch in 'o*@']
 assert active, (asset,style,'no idle detail')
 frames=[]
 for f in range(5):
  inks=[]; bgs=[]
  for y,row in enumerate(art):
   ir='';br=''
   for x,ch in enumerate(row):
    if ch==' ': k='.'
    elif (x,y) in active: k=str((f+active.index((x,y)))%5)
    elif ch in '=V*': k='a'
    elif y==cell[1]-1: k='s'
    else: k='h'
    ir+=k
    br+='d' if ch!=' ' and ch in 'oO[](){}=V' else '.'
   inks.append(ir);bgs.append(br)
  frames.append({'art':art[:],'ink':inks,'bg':bgs})
 styles=RELIC_STYLES if asset.startswith('relic_') else STYLES
 if asset.startswith('relic_'):
  pal['h']=accent
 return {'asset':asset,'name':name,'style':styles[style][0],'styleName':styles[style][1], 'cell':list(cell),'frameMs':160,'palette':pal,'frames':frames}

def savegif(frames,path,ms=160):
 # One palette for the entire loop avoids frame-to-frame palette shimmer.
 strip=Image.new('RGB',(frames[0].width*len(frames),frames[0].height))
 for i,im in enumerate(frames):strip.paste(im,(i*im.width,0))
 colors=strip.getcolors(256)
 if colors is not None:
  # Pillow's nearest-colour cache can merge very close pulse colours even
  # when the exact colours exist in its palette. Index small sprites exactly.
  values=[c for _,c in colors]; lookup={c:i for i,c in enumerate(values)}
  palette=[v for c in values for v in c]+[0]*(768-len(values)*3)
  indexed=[]
  for im in frames:
   p=Image.frombytes('P',im.size,bytes(lookup[c] for c in im.getdata()))
   p.putpalette(palette);indexed.append(p)
 else:
  palette=strip.quantize(colors=256)
  indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
 indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=ms,loop=0,optimize=False,disposal=2)

def sheet(asset,name,candidates):
 sheets=[]
 for f in range(5):
  im=Image.new('RGB',(1000,790),'#0b131d');d=ImageDraw.Draw(im)
  d.text((28,20),name,fill='#e8eef2',font=font(30))
  d.text((28,64),'BASE DESIGN STUDIES  /  five frames at 160 ms  /  Spleen 5 x 8',fill='#98abbc',font=font(15))
  for i,c in enumerate(candidates):
   x=24+(i%3)*326;y=110+(i//3)*326
   d.rounded_rectangle((x,y,x+306,y+306),radius=10,fill='#121f2c',outline='#304355')
   d.text((x+16,y+12),c['style']+'  '+c['styleName'],fill='#e2eaf0',font=font(18))
   tile=render(c['frames'][f],c['palette'],c['cell'])
   # Towers at 5x; smaller icons at the same integer scale.
   big=tile.resize((tile.width*5,tile.height*5),Image.Resampling.NEAREST)
   im.paste(big,(x+(306-big.width)//2,y+48))
   im.paste(tile,(x+18,y+256))
   d.text((x+72,y+266),'1x native / 5x above',fill='#97acbd',font=font(13))
  d.text((28,765),'Choose a letter for this asset. Upgrade trees follow after design selection.',fill='#9baebc',font=font(14))
  sheets.append(im)
 savegif(sheets,OUT/f'{asset}.gif')
 sheets[0].save(OUT/f'{asset}.png')
 for c in candidates:
  frames=[render(f,c['palette'],c['cell']).resize((c['cell'][0]*30,c['cell'][1]*48),Image.Resampling.NEAREST) for f in c['frames']]
  savegif(frames,OUT/f"{asset}-{c['style']}.gif")

def main():
 allc=[]
 for asset,(name,accent,variants) in TOWERS.items():
  cs=[candidate(asset,name,accent,art,i) for i,art in enumerate(variants)]
  sheet(asset,name,cs);allc.extend(cs)
 for asset,(name,accent,variants) in RELICS.items():
  cs=[candidate(asset,name,accent,art,i,(4,3)) for i,art in enumerate(variants)]
  sheet(asset,name,cs);allc.extend(cs)
 (HERE/'candidates.json').write_text(json.dumps(allc,ensure_ascii=False,indent=2),encoding='utf-8')
 gallery(allc)
 verify(allc)
 print(f'Generated {len(allc)} candidates, each with five idle frames.')

def gallery(candidates):
 data=[]
 for c in candidates:
  item={k:v for k,v in c.items() if k not in ('palette','frames')}
  item['images']=[]
  for f in c['frames']:
   b=io.BytesIO();render(f,c['palette'],c['cell']).save(b,format='PNG')
   item['images'].append('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())
  data.append(item)
 template=(HERE/'gallery.template.html').read_text(encoding='utf-8')
 (HERE/'index.html').write_text(template.replace('__CANDIDATES__',json.dumps(data)),encoding='utf-8')

def verify(cs):
 report=[]
 for c in cs:
  imgs=[render(f,c['palette'],c['cell']) for f in c['frames']]
  assert len({im.tobytes() for im in imgs})==5, (c['asset'],c['style'],'duplicate idle frame')
  masks=[tuple(ch!=' ' for row in f['art'] for ch in row) for f in c['frames']]
  assert len(set(masks))==1, 'Footprint moved'
  for f in c['frames']:
   for grid in ('art','ink','bg'):
    assert len(f[grid])==c['cell'][1] and all(len(r)==c['cell'][0] for r in f[grid])
   assert all(k=='.' or k in c['palette'] for r in f['ink'] for k in r)
  with Image.open(OUT/f"{c['asset']}-{c['style']}.gif") as gif:
   assert gif.n_frames==5
   assert gif.info['duration']==160
  report.append(f"{c['asset']} {c['style']}: five distinct frames; fixed footprint; valid atlas glyphs, grids, colours; GIF 5 x 160 ms")
 (HERE/'validation.txt').write_text('\n'.join(report)+'\n',encoding='utf-8')

if __name__=='__main__':main()
