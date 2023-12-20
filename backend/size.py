from PIL import Image
import os

def check_image_size(directory, target_size=(800, 800)):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                file_path = os.path.join(root, file)
                with Image.open(file_path) as img:
                    if img.size != target_size:
                        print(f"{file_path} - Size: {img.size}")

directory = 'traits'  # Replace with your directory path
check_image_size(directory)