const fs = require('fs');
const path = require('path');

// Đảm bảo thư mục dist tồn tại
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}

// Hàm sao chép tệp hoặc thư mục đệ quy
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        // Tránh lỗi khi sao chép đè tệp tin
        fs.copyFileSync(src, dest);
    }
}

// Danh sách các tài nguyên cần sao chép vào dist
const assetsToCopy = ['css', 'js', 'index.html', 'MobiFone_logo.svg.png'];

console.log('Bắt đầu sao chép tài nguyên vào thư mục dist...');
assetsToCopy.forEach((asset) => {
    if (fs.existsSync(asset)) {
        copyRecursiveSync(asset, path.join('dist', asset));
        console.log(`- Đã sao chép: ${asset}`);
    } else {
        console.warn(`- Cảnh báo: Không tìm thấy ${asset}`);
    }
});

console.log('Build hoàn tất thành công!');
