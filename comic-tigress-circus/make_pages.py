from PIL import Image, ImageDraw, ImageFont
import os

d = r"C:\Users\hebp\OneDrive\Desktop\manager\hops-and-honey-bar-manager-3d\comic-tigress-circus"

# Panel order per page
pages = {
    "page1": ["p01_intro.png","p02_trick.png","p03_kneel.png","p04_oral.png","p05_deepthroat.png","p06_position.png"],
    "page2": ["p07_doggy.png","p08_deep.png","p09_cowgirl.png","p10_matingpress.png","p11_creampie.png","p12_afterglow.png"],
}

cols, rows = 2, 3
gap = 16
margin = 32
header_h = 60

def load_thumb(path, target_w, target_h):
    im = Image.open(path).convert("RGB")
    im.thumbnail((target_w, target_h), Image.LANCZOS)
    # pad to exact size on white
    canvas = Image.new("RGB", (target_w, target_h), (255,255,255))
    x = (target_w - im.width)//2
    y = (target_h - im.height)//2
    canvas.paste(im, (x,y))
    return canvas

for pagename, panels in pages.items():
    # target each panel thumb
    # use a base width
    tw = 760
    th = int(tw * 4/3)  # 3:4 aspect
    grid_w = cols*tw + (cols+1)*gap
    grid_h = rows*th + (rows+1)*gap
    page_w = grid_w + 2*margin
    page_h = grid_h + 2*margin + header_h
    page = Image.new("RGB", (page_w, page_h), (245,242,238))
    draw = ImageDraw.Draw(page)
    try:
        font = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 36)
    except:
        font = ImageFont.load_default()
    title = "ТИГРА — ДРЕССИРОВКА С КРИСТОФЕРОМ РОБИНОМ  ·  " + pagename.upper().replace("PAGE","СТРАНИЦА ")
    draw.text((margin, margin//2), title, fill=(40,30,20), font=font)
    for i, p in enumerate(panels):
        r = i // cols
        c = i % cols
        x = margin + gap + c*(tw+gap)
        y = margin + header_h + gap + r*(th+gap)
        thumb = load_thumb(os.path.join(d, p), tw, th)
        page.paste(thumb, (x, y))
        # panel number badge
        draw.rectangle([x, y, x+44, y+44], fill=(20,20,20))
        draw.text((x+10, y+6), str(i+1), fill=(255,255,255), font=font)
    out = os.path.join(d, f"{pagename}.png")
    page.save(out, "PNG", optimize=True)
    print("SAVED", out, page.size)
