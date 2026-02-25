from PIL import Image, ImageEnhance, ImageDraw, ImageFilter

input_path = "/root/.gemini/antigravity/brain/0f5ac775-8efb-4f09-8c6d-1e77e176261c/media__1772041879204.png"
output_path = "/var/www/scada-app/public/sriboga-logo.png"

try:
    img = Image.open(input_path).convert("RGBA")
    
    # Enhance contrast
    img = ImageEnhance.Contrast(img).enhance(1.2)
    # Enhance color
    img = ImageEnhance.Color(img).enhance(1.1)
    # Sharpen
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    
    width, height = img.size
    size = min(width, height)
    left = (width - size)/2
    top = (height - size)/2
    right = (width + size)/2
    bottom = (height + size)/2
    
    img_cropped = img.crop((left, top, right, bottom))
    img_cropped = img_cropped.resize((512, 512), getattr(Image, 'Resampling', Image).LANCZOS)
    
    # Create smooth circular mask (antialias)
    mask = Image.new('L', (512*4, 512*4), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((4, 4, 512*4-4, 512*4-4), fill=255)
    mask = mask.resize((512, 512), getattr(Image, 'Resampling', Image).LANCZOS)
    
    output = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    output.paste(img_cropped, (0, 0), mask)
    
    output.save(output_path, "PNG")
    print("Logo processed successfully")
except Exception as e:
    print(f"Error processing image: {e}")
