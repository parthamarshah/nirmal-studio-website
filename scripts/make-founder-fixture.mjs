// A plain 1600x2400 portrait-shaped JPEG for test-admin-founders.sh.
import sharp from 'sharp'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2400"><rect width="1600" height="2400" fill="#c9a27e"/><circle cx="800" cy="900" r="420" fill="#3a6ea5"/><rect x="300" y="1500" width="1000" height="700" fill="#5a3"/></svg>`
await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(process.argv[2])
