import os
import json
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(base_dir, 'android', 'app', 'src', 'Neon_A_Runner_Emblem_8K.png')
    res_dir = os.path.join(base_dir, 'android', 'app', 'src', 'main', 'res')
    ios_icon_dir = os.path.join(base_dir, 'ios', 'Athleo', 'Images.xcassets', 'AppIcon.appiconset')
    assets_dir = os.path.join(base_dir, 'src', 'assets')

    print(f"Loading source image from: {source_path}")
    src_img = Image.open(source_path)

    # 1. High-quality downscale to 2048 for precision mask generation
    work_size = 2048
    work_img = src_img.resize((work_size, work_size), Image.Resampling.LANCZOS)
    arr = np.array(work_img)[:, :, :3]

    # Segment green emblem body and white runner body
    is_green = (arr[:, :, 1] > 100) & (arr[:, :, 0] < 220) & (arr[:, :, 2] < 100) & (arr[:, :, 1] > arr[:, :, 0] * 1.1)
    is_white = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 180)

    # Dilate white (the runner) to preserve its crisp black outline
    white_img = Image.fromarray((is_white * 255).astype(np.uint8))
    dilated_runner = white_img.filter(ImageFilter.MaxFilter(size=33))

    # Combine green 'A' + runner + black outline
    emblem_mask_arr = (np.array(is_green, dtype=np.uint8) * 255) | np.array(dilated_runner)
    emblem_mask = Image.fromarray(emblem_mask_arr).filter(ImageFilter.GaussianBlur(radius=1.5))

    emblem_rgba = work_img.copy().convert('RGBA')
    emblem_rgba.putalpha(emblem_mask)

    # Get tightly cropped emblem
    bbox = emblem_rgba.getbbox()
    emblem_cropped = emblem_rgba.crop(bbox)
    aspect = emblem_cropped.width / emblem_cropped.height

    print(f"Emblem bbox: {bbox}, cropped size: {emblem_cropped.size}, aspect: {aspect:.3f}")

    # 2. Android Density Configurations
    # Format: folder -> (legacy_size, foreground_size)
    android_configs = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    for folder, (leg_size, fg_size) in android_configs.items():
        target_folder = os.path.join(res_dir, folder)
        os.makedirs(target_folder, exist_ok=True)

        # A) Adaptive Foreground (ic_launcher_foreground.png)
        # 50% scale ensures the emblem safely fits inside Google's 66dp/72dp mask circle
        fg_scale = 0.50
        target_fg_w = int(fg_size * fg_scale)
        target_fg_h = int(target_fg_w / aspect)
        scaled_fg_emblem = emblem_cropped.resize((target_fg_w, target_fg_h), Image.Resampling.LANCZOS)

        fg_img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        ox = (fg_size - target_fg_w) // 2
        oy = (fg_size - target_fg_h) // 2
        fg_img.paste(scaled_fg_emblem, (ox, oy), scaled_fg_emblem)
        fg_path = os.path.join(target_folder, 'ic_launcher_foreground.png')
        fg_img.save(fg_path, format='PNG')
        print(f"Saved {fg_path} ({fg_size}x{fg_size})")

        # B) Legacy Square/Squircle (ic_launcher.png)
        # 74% scale emblem on solid black rounded plate
        target_leg_w = int(leg_size * 0.74)
        target_leg_h = int(target_leg_w / aspect)
        scaled_leg_emblem = emblem_cropped.resize((target_leg_w, target_leg_h), Image.Resampling.LANCZOS)

        leg_sq_img = Image.new('RGBA', (leg_size, leg_size), (0, 0, 0, 0))
        bg_sq = Image.new('RGBA', (leg_size, leg_size), (0, 0, 0, 0))
        d_sq = ImageDraw.Draw(bg_sq)
        d_sq.rounded_rectangle([0, 0, leg_size, leg_size], radius=max(2, int(leg_size * 0.18)), fill=(0, 0, 0, 255))
        leg_sq_img.paste(bg_sq, (0, 0))
        lox = (leg_size - target_leg_w) // 2
        loy = (leg_size - target_leg_h) // 2
        leg_sq_img.paste(scaled_leg_emblem, (lox, loy), scaled_leg_emblem)
        sq_path = os.path.join(target_folder, 'ic_launcher.png')
        leg_sq_img.save(sq_path, format='PNG')
        print(f"Saved {sq_path} ({leg_size}x{leg_size})")

        # C) Legacy Round (ic_launcher_round.png)
        # 66% scale emblem inside solid black circle
        target_rd_w = int(leg_size * 0.66)
        target_rd_h = int(target_rd_w / aspect)
        scaled_rd_emblem = emblem_cropped.resize((target_rd_w, target_rd_h), Image.Resampling.LANCZOS)

        leg_rd_img = Image.new('RGBA', (leg_size, leg_size), (0, 0, 0, 0))
        bg_rd = Image.new('RGBA', (leg_size, leg_size), (0, 0, 0, 0))
        d_rd = ImageDraw.Draw(bg_rd)
        d_rd.ellipse([0, 0, leg_size, leg_size], fill=(0, 0, 0, 255))
        leg_rd_img.paste(bg_rd, (0, 0))
        rox = (leg_size - target_rd_w) // 2
        roy = (leg_size - target_rd_h) // 2
        leg_rd_img.paste(scaled_rd_emblem, (rox, roy), scaled_rd_emblem)
        rd_path = os.path.join(target_folder, 'ic_launcher_round.png')
        leg_rd_img.save(rd_path, format='PNG')
        print(f"Saved {rd_path} ({leg_size}x{leg_size})")

    # 3. Android adaptive background color
    bg_xml_path = os.path.join(res_dir, 'values', 'ic_launcher_background.xml')
    os.makedirs(os.path.dirname(bg_xml_path), exist_ok=True)
    with open(bg_xml_path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n')
    print(f"Updated {bg_xml_path}")

    # 4. iOS AppIcon generation
    os.makedirs(ios_icon_dir, exist_ok=True)
    ios_icons = [
        {"size": "20x20", "scale": "2x", "pixels": 40, "filename": "icon-20@2x.png", "idiom": "iphone"},
        {"size": "20x20", "scale": "3x", "pixels": 60, "filename": "icon-20@3x.png", "idiom": "iphone"},
        {"size": "29x29", "scale": "2x", "pixels": 58, "filename": "icon-29@2x.png", "idiom": "iphone"},
        {"size": "29x29", "scale": "3x", "pixels": 87, "filename": "icon-29@3x.png", "idiom": "iphone"},
        {"size": "40x40", "scale": "2x", "pixels": 80, "filename": "icon-40@2x.png", "idiom": "iphone"},
        {"size": "40x40", "scale": "3x", "pixels": 120, "filename": "icon-40@3x.png", "idiom": "iphone"},
        {"size": "60x60", "scale": "2x", "pixels": 120, "filename": "icon-60@2x.png", "idiom": "iphone"},
        {"size": "60x60", "scale": "3x", "pixels": 180, "filename": "icon-60@3x.png", "idiom": "iphone"},
        {"size": "1024x1024", "scale": "1x", "pixels": 1024, "filename": "icon-1024.png", "idiom": "ios-marketing"},
    ]

    for item in ios_icons:
        px = item["pixels"]
        fn = item["filename"]
        target_w = int(px * 0.74)
        target_h = int(target_w / aspect)
        scaled_emblem = emblem_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

        ios_img = Image.new('RGB', (px, px), (0, 0, 0))
        iox = (px - target_w) // 2
        ioy = (px - target_h) // 2
        ios_img.paste(scaled_emblem, (iox, ioy), scaled_emblem)

        target_filepath = os.path.join(ios_icon_dir, fn)
        ios_img.save(target_filepath, format='PNG')
        print(f"Saved iOS icon {target_filepath} ({px}x{px})")

    contents_data = {
        "images": [
            {
                "filename": item["filename"],
                "idiom": item["idiom"],
                "scale": item["scale"],
                "size": item["size"]
            }
            for item in ios_icons
        ],
        "info": {
            "author": "xcode",
            "version": 1
        }
    }

    contents_json_path = os.path.join(ios_icon_dir, "Contents.json")
    with open(contents_json_path, 'w', encoding='utf-8') as f:
        json.dump(contents_data, f, indent=2)
    print(f"Updated {contents_json_path}")

    # 5. In-App Assets (src/assets)
    if os.path.exists(assets_dir):
        # 1024x1024 transparent master
        target_master_w = int(1024 * 0.85)
        target_master_h = int(target_master_w / aspect)
        in_app_emblem = emblem_cropped.resize((target_master_w, target_master_h), Image.Resampling.LANCZOS)

        in_app_1024 = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        mx = (1024 - target_master_w) // 2
        my = (1024 - target_master_h) // 2
        in_app_1024.paste(in_app_emblem, (mx, my), in_app_emblem)

        master_path = os.path.join(assets_dir, 'logo_master.png')
        in_app_1024.save(master_path, format='PNG')
        print(f"Updated {master_path}")

        # 512x512 logo.png
        logo_512 = in_app_1024.resize((512, 512), Image.Resampling.LANCZOS)
        logo_path = os.path.join(assets_dir, 'logo.png')
        logo_512.save(logo_path, format='PNG')
        print(f"Updated {logo_path}")

    print("\nSUCCESS: All Android, iOS, and in-app icons successfully generated!")

if __name__ == '__main__':
    main()
