const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const resizeImage = async (inputPath, outputPath) => {
    await sharp(inputPath)
        .resize(1000, 1000) // Resize to 1000x1000
        .toFile(outputPath);
};

// Example usage
const processImages = async () => {
    const imagesDir = path.join(__dirname, 'traits/memes');
    const files = fs.readdirSync(imagesDir);

    for (const file of files) {
        const inputPath = path.join(imagesDir, file);
        const outputPath = path.join(imagesDir, `resized_${file}`);
        await resizeImage(inputPath, outputPath);
    }
};

processImages(); 