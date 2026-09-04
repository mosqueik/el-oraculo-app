import struct
import zlib

def create_png(filename, width, height, r, g, b):
    """Create a simple solid color PNG file"""
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc & 0xffffffff)
    
    # IDAT chunk - create raw image data
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            raw_data += bytes([r, g, b])
    
    compressed = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc & 0xffffffff)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc & 0xffffffff)
    
    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)

# Create assets
create_png('assets/icon.png', 1024, 1024, 10, 10, 10)
print("Created icon.png")

create_png('assets/splash.png', 1284, 2778, 10, 10, 10)
print("Created splash.png")

create_png('assets/adaptive-icon.png', 1024, 1024, 10, 10, 10)
print("Created adaptive-icon.png")

create_png('assets/notification-icon.png', 96, 96, 0, 255, 136)
print("Created notification-icon.png")
