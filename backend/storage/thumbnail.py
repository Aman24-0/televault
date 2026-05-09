"""
TeleVault v2 - Thumbnail Generator
"""
import io, os, asyncio, tempfile
from PIL import Image

THUMB_SIZE = (400, 400)
IMAGE_MIMES = {"image/jpeg","image/png","image/gif","image/webp","image/bmp","image/tiff"}
VIDEO_MIMES = {"video/mp4","video/mkv","video/avi","video/mov","video/webm","video/quicktime","video/x-matroska"}

def make_image_thumb(data: bytes) -> bytes:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=80, optimize=True)
        return out.getvalue()
    except Exception as e:
        print(f"Image thumb error: {e}")
        return None

async def make_video_thumb(data: bytes, filename: str) -> bytes:
    try:
        suffix = os.path.splitext(filename)[1] or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data); tmp_in = f.name
        tmp_out = tmp_in + "_thumb.jpg"
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg","-y","-i",tmp_in,"-ss","00:00:01","-vframes","1",
            "-vf",f"scale={THUMB_SIZE[0]}:-1","-q:v","5",tmp_out,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()
        result = None
        if os.path.exists(tmp_out):
            with open(tmp_out,"rb") as f: result = f.read()
            os.unlink(tmp_out)
        os.unlink(tmp_in)
        return result
    except Exception as e:
        print(f"Video thumb error: {e}")
        return None

async def generate_thumbnail(data: bytes, filename: str, mime: str) -> bytes:
    if mime in IMAGE_MIMES: return make_image_thumb(data)
    if mime in VIDEO_MIMES: return await make_video_thumb(data, filename)
    return None
