const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Tăng giới hạn tải trọng để upload file base64 lớn

// Bộ dữ liệu mẫu sạch (không có tag màu)
const MOCK_TEMPLATES = [
  {
    id: "doc-template-1",
    name: "Hop_Dong_Dich_Vu_MobiFone_2026.txt",
    size: 14240,
    content: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---
HỢP ĐỒNG DỊCH VỤ VIỄN THÔNG & KỸ THUẬT
Số: 142/2026/HĐDV-MBFCT

Hôm nay, ngày 15 tháng 01 năm 2026, tại Văn phòng Công ty Dịch vụ MobiFone Khu vực 9 (MobiFone Cần Thơ):
Chúng tôi gồm các bên dưới đây:

BÊN A: CÔNG TY DỊCH VỤ MOBIFONE KHU VỰC 9 (MOBIFONE CẦN THƠ)
- Đại diện: Ông Nguyễn Văn A - Chức vụ: Giám đốc
- Địa chỉ: Số 06 đại lộ Hòa Bình, Quận Ninh Kiều, TP. Cần Thơ
- Mã số thuế: 0100686209-009

BÊN B: CÔNG TY CỔ PHẦN CÔNG NGHỆ THÔNG TIN PHƯƠNG NAM
- Đại diện: Bà Lê Thị B - Chức vụ: Giám đốc Điều hành
- Địa chỉ: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ
- Điện thoại: 0292.3838xxx
- Tài khoản thụ hưởng tại: Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank)
- Số tài khoản: 0111000234xxx

ĐIỀU 1: NỘI DUNG DỊCH VỤ
Bên B thực hiện cung cấp dịch vụ bảo trì định kỳ hạ tầng mạng và tích hợp hệ thống phần mềm cho Bên A tại khu vực Cần Thơ và các tỉnh lân cận theo phụ lục kỹ thuật kèm theo.

ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
1. Tổng giá trị hợp đồng tạm tính là: 120.000.000 VNĐ (Một trăm hai mươi triệu đồng chẵn). Giá này đã bao gồm thuế GTGT.
2. Phương thức thanh toán: Bên A thanh toán cho Bên B bằng hình thức chuyển khoản vào tài khoản thụ hưởng tại Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank).

Bên A cam kết thanh toán đúng hạn sau khi Bên B bàn giao biên bản nghiệm thu hợp lệ.
Hai bên thống nhất ký kết hợp đồng này làm cơ sở pháp lý thực hiện.`
  },
  {
    id: "doc-template-2",
    name: "Bien_Ban_Nghiem_Thu_Ky_Thuat.txt",
    size: 8520,
    content: `CÔNG TY DỊCH VỤ MOBIFONE KHU VỰC 9
TRUNG TÂM KỸ THUẬT MOBIFONE CẦN THƠ
---
BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO DỊCH VỤ
Hạng mục: Bảo trì hạ tầng mạng quý I/2026

Căn cứ vào Hợp đồng dịch vụ viễn thông số 142/2026/HĐDV-MBFCT ký ngày 15/01/2026.
Hôm nay, ngày 10 tháng 03 năm 2026, chúng tôi gồm có:

ĐẠI DIỆN CÔNG TY DỊCH VỤ MOBIFONE KHU VỰC 9 (BÊN A):
- Ông Trần Văn C - Chức vụ: Trưởng bộ phận Kỹ thuật
- Địa chỉ: Số 06 đại lộ Hòa Bình, Quận Ninh Kiều, TP. Cần Thơ
- Mã số thuế Bên A: 0100686209-009

ĐẠI DIỆN CÔNG TY CP CÔNG NGHỆ THÔNG TIN PHƯƠNG NAM (BÊN B):
- Ông Phạm Văn D - Chức vụ: Kỹ sư trưởng hệ thống
- Địa chỉ: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ

NỘI DUNG NGHIỆM THU:
1. Đã hoàn thành bảo trì 15 trạm phát sóng BTS khu vực trung tâm quận Ninh Kiều.
2. Đã khắc phục và nâng cấp thành công hệ thống phần mềm quản lý bản ghi.
3. Đánh giá chất lượng: Đạt tiêu chuẩn kỹ thuật yêu cầu của MobiFone Cần Thơ.

Ý KIẾN CỦA BÊN THU HƯỞNG DỊCH VỤ:
Bên A đồng ý nghiệm thu toàn phần hạng mục dịch vụ bảo trì nói trên và thực hiện thủ tục thanh toán cho Bên B theo đúng điều khoản hợp đồng. Bên B có trách nhiệm bảo hành dịch vụ 06 tháng kể từ ngày ký biên bản này.

Chuyển khoản thanh toán về tài khoản Bên B tại: Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank).`
  },
  {
    id: "doc-template-3",
    name: "De_Nghi_Thanh_Toan_MobiFone.txt",
    size: 6150,
    content: `CÔNG TY CP CÔNG NGHỆ THÔNG TIN PHƯƠNG NAM
Số: 28/ĐNTT-2026
---
GIẤY ĐỀ NGHỊ THANH TOÁN
Kính gửi: Ban Giám đốc Công ty Dịch vụ MobiFone Khu vực 9 (MobiFone Cần Thơ)

Căn cứ hợp đồng dịch vụ số 142/2026/HĐDV-MBFCT ký ngày 15/01/2026.
Căn cứ Biên bản nghiệm thu bàn giao dịch vụ ký ngày 10/03/2026.

Công ty CP Công nghệ thông tin Phương Nam đề nghị Quý công ty thanh toán số tiền đợt 1 cho dịch vụ bảo trì kỹ thuật mạng viễn thông.
Số tiền đề nghị thanh toán: 120.000.000 VNĐ (Một trăm hai mươi triệu đồng chẵn).

Thông tin đơn vị thụ hưởng:
- Tên tài khoản: Công ty Cổ phần Công nghệ thông tin Phương Nam
- Số tài khoản: 0111000234xxx
- Ngân hàng: Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank)
- Địa chỉ Bên B: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ
- Mã số thuế Bên A: 0100686209-009

Kính đề nghị Quý công ty phê duyệt và chuyển khoản thanh toán sớm để chúng tôi tiếp tục thực hiện các giai đoạn tiếp theo của dự án.
Xin trân trọng cảm ơn.`
  }
];

// Giải mã thực thể XML cơ bản
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Phân tích file .docx để trích xuất văn bản thô sạch sẽ
function parseDocxToText(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const documentXml = zip.readAsText('word/document.xml');
    if (!documentXml) {
      throw new Error("Không thể tìm thấy word/document.xml trong tệp .docx");
    }

    // Trích xuất các đoạn văn <w:p>...</w:p>
    const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch;
    let paragraphs = [];

    while ((paragraphMatch = paragraphRegex.exec(documentXml)) !== null) {
      const paragraphContent = paragraphMatch[1];
      let paragraphText = "";
      
      // Tìm tất cả các runs trong paragraph này
      let runMatch;
      const localRunRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
      
      while ((runMatch = localRunRegex.exec(paragraphContent)) !== null) {
        const runXml = runMatch[1];
        
        // Trích xuất text và ngắt dòng trong run
        const cleanRunXml = runXml
          .replace(/<w:br\b[^>]*\/>/g, '\n')
          .replace(/<w:cr\b[^>]*\/>/g, '\n')
          .replace(/<w:tab\b[^>]*\/>/g, '\t');

        let textMatch;
        const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
        while ((textMatch = textRegex.exec(cleanRunXml)) !== null) {
          paragraphText += textMatch[1];
        }
      }
      
      paragraphs.push(decodeXmlEntities(paragraphText));
    }
    
    return paragraphs.join('\n');
  } catch (error) {
    console.error("Lỗi khi phân tích tệp .docx:", error);
    throw error;
  }
}

// Sinh nội dung giả lập cho các tệp .doc cũ hoặc tệp lỗi
function generateServerSimulatedContent(filename) {
  return `TÀI LIỆU CHỨNG TỪ THANH TOÁN (GIẢ LẬP)
Tên tài liệu gốc: ${filename}
---
Đơn vị đề nghị thanh toán: Công ty Cổ phần Công nghệ thông tin Phương Nam
Mã số thuế: 0100686209-009
Địa chỉ Bên thụ hưởng: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ
Tài khoản thụ hưởng: 0111000234xxx tại Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank)
Số tiền quyết toán: 120.000.000 VNĐ

Nội dung thanh toán: Chi phí thực hiện dịch vụ bảo trì kỹ thuật và hạ tầng viễn thông cho MobiFone Cần Thơ quý I năm 2026.
Kính mong Ban Giám đốc MobiFone phê duyệt quyết toán.`;
}

// Đọc và lưu cơ sở dữ liệu db.json
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        profiles: [],
        activeProfileId: null
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Lỗi khi đọc file database:", error);
    return { profiles: [], activeProfileId: null };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Lỗi khi ghi file database:", error);
  }
}

/**
 * ==========================================================================
 * ROUTING API
 * ==========================================================================
 */

// Lấy danh sách hồ sơ
app.get('/api/profiles', (req, res) => {
  const db = readDatabase();
  res.json({
    profiles: db.profiles,
    activeProfileId: db.activeProfileId
  });
});

// Thiết lập hồ sơ đang được chọn
app.post('/api/profiles/active', (req, res) => {
  const { profileId } = req.body;
  const db = readDatabase();
  db.activeProfileId = profileId;
  writeDatabase(db);
  res.json({ success: true, activeProfileId: db.activeProfileId });
});

// Tạo hồ sơ mới
app.post('/api/profiles', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Tên hồ sơ không được để trống." });
  }

  const db = readDatabase();
  const newProfile = {
    id: "profile-" + Date.now(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    status: "new",
    replacements: [],
    files: []
  };

  db.profiles.unshift(newProfile);
  db.activeProfileId = newProfile.id;
  writeDatabase(db);
  res.status(201).json(newProfile);
});

// Xóa hồ sơ
app.delete('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  db.profiles = db.profiles.filter(p => p.id !== id);
  if (db.activeProfileId === id) {
    db.activeProfileId = null;
  }
  writeDatabase(db);
  res.json({ success: true });
});

// Thêm file vào hồ sơ
app.post('/api/profiles/:id/files', (req, res) => {
  const { id } = req.params;
  const { name, size, content } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Tên file không được trống." });
  }

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  const isDuplicate = profile.files.some(f => f.name === name);
  if (isDuplicate) {
    return res.status(400).json({ error: `File "${name}" đã tồn tại trong hồ sơ.` });
  }

  let finalContent = content || "";
  
  // Tự động giải nén và trích xuất tệp .docx thành văn bản thuần
  if (name.endsWith('.docx') && content && content.startsWith('data:')) {
    try {
      const base64Data = content.split(';base64,').pop();
      const buffer = Buffer.from(base64Data, 'base64');
      finalContent = parseDocxToText(buffer);
    } catch (err) {
      console.warn("Lỗi khi parse file docx, tự động chuyển về sinh nội dung giả lập:", err);
      finalContent = generateServerSimulatedContent(name);
    }
  } else if ((name.endsWith('.doc') || !content) && content && content.startsWith('data:')) {
    // Với file .doc cũ hoặc file rỗng, sinh dữ liệu giả lập sạch
    finalContent = generateServerSimulatedContent(name);
  }

  const newFile = {
    id: "file-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
    name,
    size: size || 0,
    originalContent: finalContent,
    currentContent: finalContent
  };

  profile.files.push(newFile);
  profile.status = "new"; // Đặt lại trạng thái chưa chỉnh sửa
  writeDatabase(db);

  res.status(201).json(newFile);
});

// Nạp nhanh bộ tài liệu mẫu vào hồ sơ
app.post('/api/profiles/:id/load-mock', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  let addedCount = 0;
  MOCK_TEMPLATES.forEach(tpl => {
    const isDuplicate = profile.files.some(f => f.name === tpl.name);
    if (!isDuplicate) {
      profile.files.push({
        id: "file-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
        name: tpl.name,
        size: tpl.size,
        originalContent: tpl.content,
        currentContent: tpl.content
      });
      addedCount++;
    }
  });

  if (addedCount > 0) {
    profile.status = "new";
    writeDatabase(db);
  }

  res.json({ success: true, addedCount, files: profile.files });
});

// Xóa file khỏi hồ sơ
app.delete('/api/profiles/:id/files/:fileId', (req, res) => {
  const { id, fileId } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  profile.files = profile.files.filter(f => f.id !== fileId);
  if (profile.files.length === 0) {
    profile.status = "new";
  }
  writeDatabase(db);
  res.json({ success: true, files: profile.files });
});

// Endpoint quét (chỉ giữ lại để tương thích ngược nếu frontend gọi)
app.post('/api/profiles/:id/scan', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }
  profile.status = "scanned";
  writeDatabase(db);
  res.json(profile);
});

// API tìm kiếm và thay thế chuỗi văn bản hàng loạt
app.post('/api/profiles/:id/replace', (req, res) => {
  const { id } = req.params;
  const { findText, replaceText, targetFileIds } = req.body;

  if (!findText) {
    return res.status(400).json({ error: "Cụm từ cần tìm kiếm không được để trống." });
  }

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  // Khởi tạo lịch sử thay thế
  if (!profile.replacements) {
    profile.replacements = [];
  }

  // Lưu vào lịch sử để highlight trong preview
  const isExist = profile.replacements.some(r => r.findText === findText && r.replaceText === replaceText);
  if (!isExist) {
    profile.replacements.push({ findText, replaceText });
  }

  // Thực hiện tìm kiếm và thay thế trong từng file được chọn
  profile.files.forEach(file => {
    if (targetFileIds.includes(file.id)) {
      const escapedFind = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedFind, 'g');
      file.currentContent = file.currentContent.replace(regex, replaceText);
    }
  });

  profile.status = "completed"; // Cập nhật trạng thái là đã chỉnh sửa thành công
  writeDatabase(db);

  res.json(profile);
});

// API khôi phục tài liệu gốc và xóa lịch sử thay thế trong hồ sơ
app.post('/api/profiles/:id/reset', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  // Khôi phục currentContent về originalContent cho tất cả các file
  profile.files.forEach(file => {
    file.currentContent = file.originalContent;
  });

  // Xóa sạch lịch sử thay thế
  profile.replacements = [];
  profile.status = "new";
  
  writeDatabase(db);
  res.json(profile);
});

// API xuất tệp tin nén ZIP (toàn bộ hoặc chỉ các tệp đã chỉnh sửa)
app.get('/api/profiles/:id/export', (req, res) => {
  const { id } = req.params;
  const { mode } = req.query; // 'all' hoặc 'edited'

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  let filesToExport = [];
  if (mode === 'edited') {
    filesToExport = profile.files.filter(f => f.currentContent !== f.originalContent);
  } else if (mode === 'custom') {
    const selectedIds = req.query.fileIds ? req.query.fileIds.split(',') : [];
    filesToExport = profile.files.filter(f => selectedIds.includes(f.id));
  } else {
    filesToExport = profile.files;
  }

  if (filesToExport.length === 0) {
    return res.status(400).json({ error: "Không có tệp tin nào để xuất bản." });
  }

  try {
    const zip = new AdmZip();
    filesToExport.forEach(file => {
      const dotIndex = file.name.lastIndexOf('.');
      const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
      const exportName = `${baseName}_hoanthien.txt`;
      
      zip.addFile(exportName, Buffer.from(file.currentContent, 'utf-8'));
    });

    const zipBuffer = zip.toBuffer();
    
    // Thiết lập headers gửi file ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(profile.name)}_export.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error("Lỗi khi tạo file nén ZIP:", err);
    res.status(500).json({ error: "Không thể tạo tệp nén ZIP." });
  }
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`Backend API Server is running on port ${PORT}`);
});
